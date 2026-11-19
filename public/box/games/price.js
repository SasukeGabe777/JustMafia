'use strict';
// Price Panic screens. TV: the product on a shelf-tag card, who's locked in, then the big price
// line where everyone's guesses slide in and the real price drops. Phone: a friendly price
// slider (log-ish for wide ranges) + fine-tune buttons + a typed box, power-ups, lock in.
// Both screens update in place (BOX.morph): animations are tied to stable per-round element ids,
// so they play once when a round's element first appears and never restart on a re-render.
(function () {
  const { esc, timer } = BOX;
  let st = { key: null, guess: 0, double: false, shield: false, typing: false }; // the phone's guess survives re-renders
  let F = null, last = null; // the studio frame (public/box/show.js) and the latest TV state
  let dragging = false, lastCtx = null; // never redraw the phone under a finger on the slider
  const release = () => { if (!dragging) return; dragging = false; if (lastCtx) setTimeout(() => lastCtx.redraw(), 0); };
  document.addEventListener('pointerup', release, true); document.addEventListener('touchend', release, true);

  const fmt = (v) => (v == null ? '' : '$' + (v < 100 && Math.round(v * 100) % 100 !== 0 ? Number(v).toFixed(2) : Math.round(v).toLocaleString('en-US')));
  const fmtStep = (s) => (s < 1 ? '$' + s.toFixed(2).replace(/^0/, '') : '$' + s.toLocaleString('en-US'));
  // Your JustGameBox character (store hat, name tag, shopping gear from the shop) where the emoji was.
  const face = (x, sz = 30, o) => (BOX.face ? BOX.face(x, sz, o) : x.avatar ? esc(x.avatar) : '');
  const who = (x, sz = 30) => (x.avatar || x.id ? face(x, sz) + ' ' : '') + esc(x.name);
  // BOX.board with faces (BOX.board escapes the name, so it can't take a picture).
  const board = (rows, val, label = '') => `<div class="board pp-board">${rows.map((r, i) => `<div class="row"><span class="n">${i + 1}</span><span>${who(r, 30)}</span><b>${esc(val(r))}${label}</b></div>`).join('')}</div>`;
  // Slider mapping: wide ranges use a power curve so small prices still get fine control.
  const curve = (max) => (max >= 200 ? 2.5 : 1);
  const toVal = (t, max) => max * Math.pow(Math.max(0, Math.min(1, t)), curve(max));
  const toT = (v, max) => Math.pow(Math.max(0, Math.min(1, v / max)), 1 / curve(max));
  const snap = (v) => { v = Math.max(0, v); if (v < 100) return Math.round(v * 100) / 100; if (v < 2000) return Math.round(v); if (v < 20000) return Math.round(v / 10) * 10; return Math.round(v / 100) * 100; };
  const steps = (max) => { const s = [0.1, 1, 10, 100, 1000, 10000].filter((x) => x <= max / 4).slice(-3); return s.length ? s : [0.1]; };
  const KIND = {
    guess: { icon: '🏷️', title: 'Guess the price!' },
    hilo: { icon: '⬆️⬇️', title: 'Higher or Lower?', sub: 'Is the real price higher or lower? Tap fast: speed bonus!' },
    versus: { icon: '⚖️', title: 'Which Costs More?', sub: 'Two items, one tap. Pick the pricier one. Fast = bonus!' },
    spree: { icon: '🛒', title: 'Shopping Spree!', sub: 'Final round! Three items: guess the TOTAL. Points count DOUBLE!' },
  };

  const priceTag = (it, k) => (it.price == null ? '<div class="pp-tag"><span class="pp-hole"></span>$ ? ? ?</div>'
    : `<div class="pp-tag real pp-drop" id="tag-${k}"><span class="pp-hole"></span>${fmt(it.price)}</div>`);
  const card = (it, size, k, extra = '') => `<div class="pp-card ${size || ''} ${extra}"><div class="pp-ribbon">${esc(it.catIcon)} ${esc(it.cat)}</div>
    <div class="pp-photo"><span>${esc(it.emoji)}</span></div><div class="pp-name">${esc(it.name)}</div><div class="pp-desc">${esc(it.desc)}</div>${size === 'mini' ? '' : priceTag(it, k)}</div>`;
  const cards = (s, size) => `<div class="pp-cards n${s.items.length}">${s.items.map((it, i) => card(it, size, s.round + '-' + i)).join('')}</div>`;

  // The big price line: guesses as markers, then the real price drops in.
  function line(s) {
    const ax = s.axis || 1, pos = (v) => Math.max(0, Math.min(100, (v / ax) * 100));
    const marks = s.marks.filter((m) => m.guess != null).sort((a, b) => a.guess - b.guess);
    const labelAll = marks.length <= 14, top = new Set(s.top || []);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => `<span class="pp-tick" style="left:${f * 100}%">${fmt(ax * f)}</span>`).join('');
    const ms = marks.map((m, i) => {
      const cls = ['pp-mark', 'pp-slide'];
      if (s.dropped) { if (top.has(m.id)) cls.push('top'); if (m.bust) cls.push('bust'); if (m.bull) cls.push('bull'); }
      const label = labelAll || (s.dropped && top.has(m.id));
      const off = m.guess > ax ? ' ➜' : '';
      return `<div class="${cls.join(' ')}" style="left:${pos(m.guess)}%;--c:${esc(m.color)};--d:${(i % 20) * 45}ms"><i>${s.dropped && m.bust ? '💥' : ''}</i>${label ? `<span class="pp-lab ${i % 2 ? 'dn' : 'up'}">${s.dropped && top.has(m.id) ? (s.top[0] === m.id ? '👑 ' : '⭐ ') : ''}${who(m)} <b>${fmt(m.guess)}${off}</b></span>` : ''}</div>`;
    }).join('');
    const pin = s.dropped ? `<div class="pp-pin pp-pin-drop" style="left:${pos(s.price)}%"><b>${fmt(s.price)}</b></div>` : '';
    return `<div class="pp-line ${labelAll ? '' : 'crowd'}" id="line-${s.round}"><div class="pp-axis"></div>${ticks}${ms}${pin}</div>`;
  }
  const mathRows = (math) => `<table class="pp-math">${math.map((r) => `<tr><td>${esc(r.label)}</td><td>${esc(r.val)}</td></tr>`).join('')}</table>`;
  const fastest = (s) => {
    const fast = s.dropped ? s.marks.filter((m) => m.right).sort((a, b) => b.pts - a.pts).slice(0, 3) : [];
    return fast.length ? `<div class="pp-fast">⚡ Fastest right: ${fast.map((m) => `<span class="pp-chip" style="--c:${esc(m.color)}">${who(m)} +${m.pts}</span>`).join('')}</div>` : s.dropped ? '<div class="pp-fast">Nobody got it! 😬</div>' : '';
  };

  function tvReveal(s) {
    if (s.kind === 'hilo') {
      const up = s.dropped && s.price > s.hiloPrice;
      const higher = s.marks.filter((m) => m.pick === 'higher').length, lower = s.marks.filter((m) => m.pick === 'lower').length;
      return `${cards(s, '')}<div class="pp-hilo-res">
        <div class="pp-hl-col ${s.dropped ? (up ? 'win' : 'lose') : ''}">⬆️ HIGHER<b>${higher}</b></div>
        <div class="pp-hl-mid">${s.dropped ? `It’s <b>${fmt(s.price)}</b><br><span class="muted">vs ${fmt(s.hiloPrice)}</span>` : `🥁 Was it more than <b>${fmt(s.hiloPrice)}</b>?`}</div>
        <div class="pp-hl-col ${s.dropped ? (!up ? 'win' : 'lose') : ''}">⬇️ LOWER<b>${lower}</b></div></div>${fastest(s)}`;
    }
    if (s.kind === 'versus') {
      const win = s.dropped ? (s.items[0].price > s.items[1].price ? 0 : 1) : -1;
      const n = [0, 1].map((i) => s.marks.filter((m) => m.pick === i).length);
      return `<div class="pp-vs">${s.items.map((it, i) => `${i ? `<div class="pp-vs-mid">${s.dropped ? '' : '🥁'}VS</div>` : ''}<div class="pp-vs-side ${win === i ? 'win' : win >= 0 ? 'lose' : ''}">${card(it, 'slimv', s.round + '-' + i)}<div class="pp-vs-n"><b>${n[i]}</b> picked this</div></div>`).join('')}</div>
        ${s.dropped ? `<div class="big-status pp-vs-res">${esc(s.items[win].name)} costs more! ${s.summary.right}/${s.marks.length} got it</div>` : '<div class="big-status pp-drum">🥁 Which one costs more…</div>'}${fastest(s)}`;
    }
    const sm = s.summary;
    const best = s.dropped ? (s.top || []).map((id) => s.marks.find((m) => m.id === id)).filter(Boolean) : [];
    return `${cards(s, s.items.length > 1 ? 'mini' : 'slim')}
      ${s.kind === 'spree' && s.dropped ? `<div class="pp-total">Total: <b>${fmt(s.price)}</b></div>` : ''}
      ${s.marks.length ? line(s) : '<div class="big-status">Nobody guessed! 🙈</div>'}
      ${s.dropped ? `<div class="pp-sum">${sm.exact ? `<span>💰 ${sm.exact} JACKPOT!</span>` : ''}<span>🎯 ${sm.bulls} bullseye${sm.bulls === 1 ? '' : 's'}</span><span>💥 ${sm.busts} bust${sm.busts === 1 ? '' : 's'}</span>${sm.avg != null && s.marks.length > 2 ? `<span>👥 Room average ${fmt(sm.avg)} <small class="muted">(${sm.avgPct}% ${sm.avgOver ? 'over' : 'under'})</small></span>` : ''}</div>
        <div class="pp-best">${best.map((m, i) => `<div class="pp-bestcard ${i === 0 ? 'first' : ''}" style="--c:${esc(m.color)}"><h4>${i === 0 ? '👑' : '⭐'} ${who(m)} <span>${fmt(m.guess)}</span></h4>${mathRows(m.math)}<div class="pp-tot">+${m.pts}</div></div>`).join('')}</div>`
      : '<div class="big-status pp-drum">🥁 And the actual price is…</div>'}`;
  }

  function tvOver(s) {
    const [w, ...rest] = s.standings;
    const podium = s.standings.slice(0, 3);
    return `<div class="final pp-final"><h2 class="pp-champ">🛍️ Shopping champion: ${w ? who(w, 52) : ''}</h2>
      ${podium.length > 1 ? `<div class="pp-podium">${[podium[1], podium[0], podium[2]].filter(Boolean).map((p) => `<div class="pp-pod ${p === w ? 'gold' : p === podium[1] ? 'silver' : 'bronze'}"><div class="pp-podfig">${BOX.body ? BOX.body(p, p === w ? 132 : 108, { mood: p === w ? 'grin' : undefined }) : ''}</div><div class="nm">${esc(p.name)}</div><div class="bar">${p === w ? '🥇' : p === podium[1] ? '🥈' : '🥉'}<b>${p.points.toLocaleString('en-US')}</b></div></div>`).join('')}</div>` : ''}
      <div class="pp-awards">${(s.awards || []).map((a, i) => `<div class="pp-award" style="animation-delay:${0.8 + i * 0.3}s"><div class="ic">${a.icon}</div><b>${esc(a.title)}</b><div>${a.id ? face(a, 34) + ' ' : ''}${esc(a.name)}</div><small class="muted">${esc(a.why)}</small></div>`).join('')}</div>
      ${rest.length > 2 ? `<div class="pp-finalboard">${board((s.standings.slice(0, 8)), (r) => r.points.toLocaleString('en-US'), ' pts')}</div>` : ''}</div>`;
  }

  BOX.games.price = {
    // Soundtrack cue per phase (public/box/scores/<key>.js); the TV turns the last 10 s of 'think' tense.
    music: (s) => ({ intro: 'play', guess: 'think', reveal: 'reveal', over: 'finale' }[s.phase] || 'play'),
    name: 'Price Panic', icon: '🏷️',
    about: 'A product hits the shelf. Guess its price on your phone. Close is good, exact is a jackpot, and going over is a bust!',
    how: [
      'A product appears on the big screen. Slide, tap or type your guess on your phone, then lock it in.',
      'Up to 1000 points for being close. Go OVER the real price and your points are halved: bust!',
      'Within 5% without going over is a Bullseye (+500). The exact price is a Jackpot (+1000). Three close rounds in a row: Hot Streak (+300).',
      'Power-ups, once each per game: 🎯 Double Down (×2), 🛡️ Bust Shield, 👀 Peek at the room’s average.',
      'Quick-tap rounds: ⬆️⬇️ Higher or Lower and ⚖️ Which Costs More (be fast!). The last round is a 🛒 Shopping Spree worth DOUBLE points.',
    ],
    fx: { item: 'whoosh', lock: 'click', drum: 'drum', drop: 'reveal', bull: 'cheer', jackpot: 'win', bust: 'poof', hilo: 'sting', versus: 'sting', spree: 'swell', over: 'win' },
    // The host and the studio audience react to the game's cues.
    onFx(f) {
      if (!F) return;
      const s = last || {}, topName = () => { const id = (s.top || [])[0], m = id && (s.marks || []).find((x) => x.id === id); return m ? m.name : null; };
      const pick = (a) => a[Math.floor(Math.random() * a.length)];
      switch (f.kind) {
        case 'item': F.react({ line: pick(['Here comes our next item!', 'Feast your eyes on this beauty!', 'What do you think this one costs?', 'Ooh, look at this, folks! Lock in your guesses!']), pose: 'point', mood: 'clap', prio: 2 }); break;
        case 'hilo': F.react({ line: 'Higher or lower? Make it snappy!', pose: 'point', mood: 'clap', prio: 2 }); break;
        case 'versus': F.react({ line: 'Two items enter. Which one costs more?', pose: 'shrug', mood: 'clap', prio: 2 }); break;
        case 'spree': F.react({ line: 'Final round! A shopping spree, and the points are doubled!', pose: 'cheer', mood: 'cheer', prio: 3 }); break;
        case 'lock': F.react({ mood: 'clap', moodMs: 900, prio: 0 }); break;
        case 'drum': F.react({ line: 'And the actual retail price is…', pose: 'point', mood: 'gasp', moodMs: 1800, prio: 2 }); break;
        case 'drop': F.react({ line: 'There it is!', mood: 'clap', prio: 1 }); break;
        case 'jackpot': F.react({ line: `JACKPOT! ${topName() || 'Somebody'} got it right on the nose!`, pose: 'cheer', mood: 'cheer', moodMs: 3500, confetti: true, prio: 3 }); break;
        case 'bull': F.react({ line: s.kind === 'hilo' || s.kind === 'versus' ? 'Look at those lightning-fast fingers!' : `Bullseye! ${topName() || 'Somebody'} nailed it!`, pose: 'cheer', mood: 'cheer', prio: 3 }); break;
        case 'bust': F.react({ line: pick(['Ooh! Somebody went over! Bust!', 'Too high, too high! That’s a bust!']), pose: 'shrug', mood: 'groan', prio: 2 }); break;
        case 'over': { const w = (s.standings || [])[0]; F.react({ line: `What a show! Give it up for ${w ? w.name : 'our winner'}, tonight's shopping champion!`, pose: 'cheer', mood: 'cheer', moodMs: 5000, confetti: true, prio: 4 }); break; }
        default:
      }
    },

    tv(el, s) {
      if (!s) return;
      // The game is played inside a TV studio: the set behind, Sterling Sparks at his podium, the audience below.
      F = BOX.studio ? BOX.studio.frame(el, 'price') : null; last = s;
      const root = F ? F.content : el;
      if (s.phase === 'over') { BOX.morph(root, `<div id="pp-over"><div class="pp-overhost"><div class="st-slot" data-keep></div></div>${tvOver(s)}</div>`); if (F) F.attach(); return; }
      const k = KIND[s.kind] || KIND.guess;
      let main = '';
      if (s.phase === 'intro') {
        main = `<div class="pp-intro pp-pop ${s.kind}" id="intro-${s.round}"><div class="pp-intro-ic">${k.icon}</div><h2>${esc(k.title)}</h2><p>${esc(k.sub || '')}</p>${s.final ? `<div class="pp-x2">🏁 FINAL ROUND · POINTS ×${s.mult}</div>` : ''}</div>`;
      } else if (s.phase === 'guess') {
        const ask = s.kind === 'hilo' ? `<div class="pp-ask">Is the real price <b>HIGHER</b> or <b>LOWER</b> than<div class="pp-tag big hilo"><span class="pp-hole"></span>${fmt(s.hiloPrice)}</div></div>`
          : s.kind === 'versus' ? '<div class="pp-ask">⚖️ Which one costs <b>MORE</b>? Tap it on your phone!</div>'
            : `<div class="pp-ask">${s.kind === 'spree' ? `🛒 Guess the <b>TOTAL</b> for all three! <span class="pp-x2 inline">×${s.mult} points</span>` : '📱 What does it cost? Guess on your phone!'}</div>`;
        // Twelve or fewer: the contestants stand in a row (full characters in their gear); more: name chips.
        const staged = s.lockers.length <= 12 && !!BOX.body;
        const chips = s.lockers.map((p) => (staged ? `<span class="pp-contestant ${p.in ? 'in' : ''}" style="--c:${esc(p.color)}">${BOX.body(p, 96, { mood: p.in ? 'grin' : undefined })}<span class="pp-chip ${p.in ? 'in' : ''}">${p.in ? '🔒 ' : ''}${esc(p.name)}</span></span>`
          : `<span class="pp-chip ${p.in ? 'in' : ''}" style="--c:${esc(p.color)}">${p.in ? '🔒 ' : ''}${who(p, 28)}</span>`)).join('');
        const stage = s.kind === 'versus'
          ? `<div class="pp-vs pp-enter">${s.items.map((it, i) => `${i ? '<div class="pp-vs-mid">VS</div>' : ''}<div class="pp-vs-side">${card(it, 'slimv', s.round + '-' + i)}</div>`).join('')}</div>`
          : `<div class="pp-enter">${cards(s, s.items.length > 1 ? '' : 'hero')}</div>`;
        main = `<div id="g-${s.round}">${stage}</div>${ask}
          <div class="pp-status"><span>${s.locked} / ${s.total} locked in</span><span class="pp-clock">⏱ ${timer(s.endsIn)}</span></div>
          ${s.waiting ? `<div class="pp-waiting">⏳ Waiting on ${s.waiting.map(esc).join(', ')}</div>` : ''}
          <div class="pp-chips ${staged ? 'staged' : ''}">${chips}${s.total > s.lockers.length ? `<span class="pp-chip">+${s.total - s.lockers.length} more</span>` : ''}</div>`;
      } else if (s.phase === 'reveal') main = `<div id="r-${s.round}">${tvReveal(s)}</div>`;
      const label = s.kind === 'guess' ? `Round ${s.round} of ${s.rounds}` : `${k.icon} ${k.title} · Round ${s.round} of ${s.rounds}`;
      BOX.morph(root, `<div class="pp-wrap"><section class="pp-stage"><div class="pp-top"><span class="pp-logo">🏷️ Price Panic</span><span class="pp-round">${esc(label)}</span>${s.final ? `<span class="pp-x2 inline">🏁 ×${s.mult}</span>` : ''}</div>${main}<div class="pp-note">${esc(s.note)}</div></section>
        <aside class="pp-side"><div class="st-slot" data-keep></div><div class="panel"><h3 style="margin-top:0">Leaderboard</h3>${board((s.standings), (r) => r.points.toLocaleString('en-US'), '')}</div></aside></div>`);
      if (F) F.attach();
    },

    // The lobby is the studio's store set: the settings are products on a shelf, the code is a giant price tag.
    lobbyTv(el, L) {
      if (!BOX.studio) return;
      BOX.studio.lobby(el, L, { key: 'price', title: '<span class="a">Price</span> <span class="b">Panic!</span>', tagline: 'Guess what it costs. Closest wins, but go over and you bust!',
        icons: { rounds: '🛒', seconds: '⏱️', category: '🏬', showIntro: '🎤' }, setTitle: '🛍️ Aisle 1 · Tonight’s rules (click a product to change it)', joinTitle: 'Scan to shop!',
        startLabel: '💸 Open the store!', crowdTitle: 'shoppers in line', emptyCrowd: 'The store is empty… scan the price tag to join!' });
    },

    phone(el, v, ctx) {
      // JustGold gear: this game's phone theme, a frame and badge over your screen (public/shared/gear.js).
      if (window.MT_GEAR) window.MT_GEAR.phoneTheme(el, arguments[3], 'price');
      if (!v) return;
      lastCtx = ctx;
      if (dragging) return;
      if (v.phase === 'over') {
        BOX.morph(el, `<div class="card-box pp-overme" style="text-align:center"><div class="pp-place">${v.rank === 1 ? '🏆' : v.rank === 2 ? '🥈' : v.rank === 3 ? '🥉' : '🛍️'}</div><h3>You finished #${v.rank} of ${v.of}</h3><p>${v.points.toLocaleString('en-US')} points</p>
          ${v.awards.map((a) => `<div class="pp-myaward">${a.icon} <b>${esc(a.title)}</b><br><small class="muted">${esc(a.why)}</small></div>`).join('')}</div>
          <div class="card-box">${board((v.final), (r) => r.points.toLocaleString('en-US'), '')}</div>`); return;
      }
      const k = KIND[v.kind] || KIND.guess;
      const head = `<div class="bl-me"><span>🏅 ${v.points.toLocaleString('en-US')} pts · #${v.rank || '-'}${v.streak >= 2 ? ` · 🔥${v.streak}` : ''}</span><span class="muted">${v.final ? `🏁 Final ×${v.mult}` : `Round ${v.round}/${v.rounds}`}</span></div>`;
      const mini = `<div class="pp-cards n${v.items.length}">${v.items.map((it) => card(it, 'mini')).join('')}</div>`;
      if (v.phase === 'intro') { BOX.morph(el, `${head}<div class="pp-intro small pp-pop" id="pi-${v.round}"><div class="pp-intro-ic">${k.icon}</div><h2>${esc(k.title)}</h2><p>${esc(k.sub || '')}</p></div>`); return; }

      if (v.phase === 'guess' && v.kind === 'versus') {
        if (v.mine) { BOX.morph(el, `${head}<div class="pp-locked"><div class="muted">You picked</div><div class="pp-vs-picked">${esc(v.items[v.mine.pick].emoji)} ${esc(v.items[v.mine.pick].name)}</div><div>🔒 Locked in</div></div><p class="muted" style="text-align:center">Waiting for everyone… ${timer(v.endsIn)}</p>`); return; }
        BOX.morph(el, `${head}<div class="pp-ask small">⚖️ Tap the one that costs <b>MORE</b> ${timer(v.endsIn)}</div>
          <div class="pp-vs-btns">${v.items.map((it, i) => `<button class="pp-vs-btn" data-v="${i}"><span class="e">${esc(it.emoji)}</span><b>${esc(it.name)}</b><small>${esc(it.desc)}</small></button>`).join('')}</div>`);
        for (const b of el.querySelectorAll('[data-v]')) b.onclick = async () => { const r = await ctx.act({ op: 'versus', pick: Number(b.dataset.v) }); if (r.ok) { ctx.sfx('click'); ctx.vibrate(30); ctx.redraw(); } };
        return;
      }
      if (v.phase === 'guess' && v.kind === 'hilo') {
        if (v.mine) { BOX.morph(el, `${head}${mini}<div class="big-status">You said ${v.mine.pick === 'higher' ? '⬆️ HIGHER' : '⬇️ LOWER'} 🔒</div><p class="muted" style="text-align:center">Than ${fmt(v.hiloPrice)} · ${timer(v.endsIn)}</p>`); return; }
        BOX.morph(el, `${head}${mini}<div class="pp-ask small">Higher or lower than <b>${fmt(v.hiloPrice)}</b>? ${timer(v.endsIn)}</div>
          <div class="pp-hl-btns"><button class="pp-hl up" data-h="higher">⬆️<b>HIGHER</b></button><button class="pp-hl down" data-h="lower">⬇️<b>LOWER</b></button></div>`);
        for (const b of el.querySelectorAll('[data-h]')) b.onclick = async () => { const r = await ctx.act({ op: 'hilo', pick: b.dataset.h }); if (r.ok) { ctx.sfx('click'); ctx.vibrate(30); ctx.redraw(); } };
        return;
      }

      if (v.phase === 'guess') {
        if (v.mine) {
          const pw = [v.mine.double ? '🎯 Double Down' : '', v.mine.shield ? '🛡️ Bust Shield' : ''].filter(Boolean).join(' + ');
          BOX.morph(el, `${head}${mini}<div class="pp-locked"><div class="muted">Locked in at</div><div class="pp-amt">${fmt(v.mine.guess)}</div>${pw ? `<div>${pw} active!</div>` : ''}</div><p class="muted" style="text-align:center">Waiting for everyone… ${timer(v.endsIn)}</p>`);
          return;
        }
        const max = v.sliderMax, key = v.round + '|' + v.items.map((i) => i.name).join(',');
        if (st.key !== key) st = { key, guess: snap(toVal(0.35, max)), double: false, shield: false, typing: false };
        const used = new Set(v.used);
        if (used.has('double')) st.double = false; if (used.has('shield')) st.shield = false;
        const stp = steps(max);
        const pow = (p, ic, name, sub) => `<button class="pp-pow ${st[p] ? 'on' : ''}" data-p="${p}" ${used.has(p) ? 'disabled' : ''}>${ic}<b>${name}</b><small>${used.has(p) ? 'used' : sub}</small></button>`;
        const peekUsed = used.has('peek') && !v.peek;
        BOX.morph(el, `${head}${mini}${v.kind === 'spree' ? `<div class="pp-ask small">🛒 Guess the <b>TOTAL</b> of all three! <span class="pp-x2 inline">×${v.mult}</span></div>` : ''}
          <div class="pp-guess"><div class="pp-amt" id="pp-amt">${fmt(st.guess)}</div>
          <input type="range" class="pp-range" id="pp-range" min="0" max="1000" step="1" value="${Math.round(toT(st.guess, max) * 1000)}" aria-label="Your price guess">
          <div class="pp-scale"><span>$0</span><span>${timer(v.endsIn)}</span><span>${fmt(max)}+</span></div>
          <div class="pp-tune">${stp.slice().reverse().map((x) => `<button data-d="${-x}">−${fmtStep(x)}</button>`).join('')}${stp.map((x) => `<button data-d="${x}">+${fmtStep(x)}</button>`).join('')}</div>
          ${st.typing ? '<div class="pp-type" id="pp-typerow"><span>$</span><input id="pp-typed" type="number" inputmode="decimal" step="any" min="0" placeholder="exact price"><button class="btn small" id="pp-set">Set</button></div>'
            : '<button class="pp-typelink" id="pp-typeopen">⌨️ Type an exact price</button>'}</div>
          <div class="pp-powers">${pow('double', '🎯', 'Double Down', '×2 this round')}${pow('shield', '🛡️', 'Bust Shield', 'going over is OK')}
            <button class="pp-pow ${v.peek ? 'on' : ''}" id="pp-peek" ${peekUsed || v.peek || !v.peekReady ? 'disabled' : ''}>👀<b>Peek</b><small>${v.peek ? 'peeking!' : peekUsed ? 'used' : v.peekReady ? 'see the average' : 'at half time'}</small></button></div>
          ${v.peek ? `<div class="pp-peek">👀 Room average so far: <b>${v.peek.avg != null ? fmt(v.peek.avg) : 'nobody yet'}</b> <span class="muted">(${v.peek.n} locked in)</span></div>` : ''}
          <button class="btn big green pp-lockbtn" id="pp-lock">🔒 Lock in <span id="pp-lockamt">${fmt(st.guess)}</span></button>`);
        const range = el.querySelector('#pp-range'), typed = el.querySelector('#pp-typed');
        const paint = (fromRange) => {
          el.querySelector('#pp-amt').textContent = fmt(st.guess); el.querySelector('#pp-lockamt').textContent = fmt(st.guess);
          if (!fromRange) range.value = String(Math.round(toT(st.guess, max) * 1000));
        };
        const set = (g) => { if (!Number.isFinite(g)) return; st.guess = snap(Math.min(Math.max(0, g), max * 20)); paint(false); };
        const grab = () => { dragging = true; };
        const drop = () => { if (!dragging) return; dragging = false; ctx.vibrate(6); setTimeout(() => ctx.redraw(), 0); };
        range.onpointerdown = grab; range.ontouchstart = grab;
        range.onpointerup = drop; range.onpointercancel = drop; range.ontouchend = drop; range.ontouchcancel = drop;
        range.oninput = () => { st.guess = snap(toVal(Number(range.value) / 1000, max)); paint(true); };
        range.onchange = () => { drop(); range.blur(); }; // let the shell redraw again once the drag ends
        for (const b of el.querySelectorAll('[data-d]')) b.onclick = () => { set(st.guess + Number(b.dataset.d)); ctx.vibrate(8); };
        const open = el.querySelector('#pp-typeopen');
        if (open) open.onclick = () => { st.typing = true; ctx.redraw(); const t = el.querySelector('#pp-typed'); if (t) t.focus(); };
        const applyTyped = () => { if (!typed) return; const n = parseFloat(String(typed.value).replace(/[$,\s]/g, '')); if (Number.isFinite(n)) set(n); typed.value = ''; typed.blur(); };
        if (typed) {
          typed.onkeydown = (e) => { if (e.key === 'Enter') applyTyped(); };
          typed.onchange = applyTyped;
          el.querySelector('#pp-set').onclick = applyTyped;
        }
        for (const b of el.querySelectorAll('[data-p]')) b.onclick = () => { st[b.dataset.p] = !st[b.dataset.p]; b.classList.toggle('on', st[b.dataset.p]); ctx.vibrate(15); };
        const pk = el.querySelector('#pp-peek'); pk.onclick = async () => { const r = await ctx.act({ op: 'peek' }); if (r.ok) ctx.sfx('chime'); };
        el.querySelector('#pp-lock').onclick = async () => {
          if (typed && typed.value) applyTyped();
          const r = await ctx.act({ op: 'lock', guess: st.guess, double: st.double, shield: st.shield });
          if (r.ok) { ctx.sfx('click'); ctx.vibrate(40); ctx.redraw(); }
        };
        return;
      }

      if (v.phase === 'reveal') {
        if (!v.dropped) {
          const said = v.mine ? (v.mine.guess != null ? `You guessed <b>${fmt(v.mine.guess)}</b>` : v.kind === 'versus' ? `You picked <b>${esc(v.items[v.mine.pick].name)}</b>` : `You said <b>${v.mine.pick === 'higher' ? 'HIGHER' : 'LOWER'}</b>`) : '';
          BOX.morph(el, `${head}${mini}<div class="big-status pp-drum">🥁 Look at the TV!</div>${said ? `<p style="text-align:center">${said}</p>` : ''}`); return;
        }
        const r = v.result;
        const real = v.kind === 'hilo' ? `It was <b>${fmt(v.price)}</b> (${v.price > v.hiloPrice ? 'higher' : 'lower'} than ${fmt(v.hiloPrice)})`
          : v.kind === 'versus' ? v.items.map((it) => `${esc(it.emoji)} ${esc(it.name)}: <b>${fmt(it.price)}</b>`).join('<br>') : `Real price: <b>${fmt(v.price)}</b>`;
        let body;
        if (!r) body = `<h3>You sat this one out</h3>${v.kind === 'hilo' || v.kind === 'versus' ? '' : '<p class="muted">No guess, no points (and no streak).</p>'}`;
        else {
          const tapRound = v.kind === 'hilo' || v.kind === 'versus';
          const big = r.exact ? '💰 JACKPOT!' : r.bull ? '🎯 Bullseye!' : r.bust ? '💥 Bust!' : tapRound ? (r.right ? '✅ Right!' : '❌ Nope!') : r.pct <= 15 ? '👏 So close!' : r.pct <= 40 ? '👍 Not bad' : '😅 Way off';
          const place = r.place && v.placed > 1 && r.pts > 0 ? `<div class="pp-placed">${r.place === 1 ? '🥇 Best in the room!' : `#${r.place} of ${v.placed} this round`}</div>` : '';
          body = `<h3 class="pp-big ${r.bust || r.right === false || !r.pts ? 'bad' : 'good'}">${big}</h3>${r.guess != null ? `<p>You guessed <b>${fmt(r.guess)}</b></p>` : ''}${mathRows(r.math)}<div class="pp-tot">+${r.pts}</div>${place}`;
          const mark = v.round + ':' + v.kind;
          if (el.dataset.res !== mark) { el.dataset.res = mark; if (r.exact || r.bull || r.right) { ctx.sfx(r.exact ? 'win' : 'cheer'); ctx.vibrate(120); } else if (r.bust) ctx.vibrate([60, 40, 60]); }
        }
        const crowd = v.summary && v.summary.avg != null && v.placed > 2 ? `<p class="muted">👥 The room averaged ${fmt(v.summary.avg)} (${v.summary.avgPct}% off)</p>` : '';
        BOX.morph(el, `${head}${mini}<div class="card-box pp-result" style="text-align:center"><p>${real}</p>${body}${crowd}</div>`);
        return;
      }
      BOX.morph(el, `${head}<div class="big-status">Next item coming…</div>`);
    },
  };
})();
