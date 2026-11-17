'use strict';
// JustBid screens. TV: a warehouse aisle, the locker's roll-up door half open with three
// silhouetted clues, the auctioneer's patter, the current bid in huge numbers, a countdown
// ring and a bid ticker; then SOLD!, the item-by-item unpacking and a big PROFIT / LOSS.
// Phone: big bid buttons, your cash and "You're winning!" / "Outbid!", flashlight, bank loan,
// sealed-bid envelope and your collection with set progress.
(function () {
  const { esc } = BOX;
  if (!document.querySelector('link[data-jb-css]')) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/box/games/bid.css'; l.dataset.jbCss = '1';
    document.head.appendChild(l);
  }
  const money = (v) => (v == null ? '' : (v < 0 ? '−$' : '$') + Math.abs(Math.round(v)).toLocaleString('en-US'));
  const signed = (v) => (v >= 0 ? '+' : '') + money(v);
  let F = null, last = null; // the studio frame (public/box/show.js) and the latest TV state
  const seen = new Set();
  let lastRound = 0; // a new game (Play again) starts the one-shot animations over
  const newGame = (r) => { if (r < lastRound) seen.clear(); lastRound = r || 0; };
  const once = (k) => { if (seen.has(k)) return false; seen.add(k); if (seen.size > 600) seen.clear(); return true; };
  // Seconds left on the hammer: [data-jb-ends] elements count down by themselves.
  setInterval(() => { for (const el of document.querySelectorAll('[data-jb-ends]')) el.textContent = String(Math.max(0, Math.ceil((Number(el.dataset.jbEnds) - Date.now()) / 1000))); }, 200);
  const endsAt = (ms) => Date.now() + (ms || 0);
  const bucket = (ms) => (ms ? Math.round(endsAt(ms) / 600) : 0);
  // Only repaint when something visible changed (keeps animations and taps steady).
  const paint = (el, sig, html) => { if (el.dataset.jbSig === sig && el.querySelector('.jb-root')) return false; el.dataset.jbSig = sig; el.innerHTML = html; return true; };
  const sigOf = (s, extra) => JSON.stringify({ ...s, endsIn: bucket(s.endsIn), x: extra || null });
  const RAR = { J: 'Junk', C: 'Common', G: 'Good', R: 'Rare', E: 'Epic', L: 'LEGENDARY' };
  const STAGE = ['', 'Going once…', 'Going twice…'];

  function patter(s) {
    const L = s.locker, h = s.high, n = s.bidCount || 0;
    if (s.phase === 'preview') return ['Step right up, folks! Take a good look inside…', 'Ooh, what have we got here? Have a peek!', 'Fresh locker, folks! Eyes on the clues!'][s.round % 3];
    if (s.stage === 2) return h ? `Going twice… at ${money(h.amount)}! Last chance!` : `Going twice… nobody? Not even ${money(L.opening)}?`;
    if (s.stage === 1) return h ? `${money(h.amount)}… going once…` : `Going once at ${money(L.opening)}…`;
    if (!h) return [`Who'll open at ${money(L.opening)}? Anyone?`, `Let's start at ${money(L.opening)}, do I hear it?`][s.round % 2];
    const lines = [`${h.name} has it at ${money(h.amount)}! Do I hear ${money(h.amount + 10)}?`, `${money(h.amount)}! Who'll give me ${money(h.amount + 25)}?`,
      `I've got ${money(h.amount)} from ${h.name}! Don't be shy!`, `${money(h.amount)}, ${money(h.amount)}… do I hear more?`, `New bid! ${money(h.amount)}! Look at those clues, folks!`];
    return lines[n % lines.length];
  }
  const kindPill = (L) => (L.kind === 'normal' ? '' : `<span class="jb-pill k-${esc(L.kind)}">${L.kindIcon} ${esc(L.kindLabel)}</span>`);
  const clueHtml = (L, cls = '') => (L.clues.length
    ? L.clues.map((c, i) => `<div class="jb-clue ${cls}" style="--i:${i}"><div class="jb-sil">${esc(c.icon)}</div><div class="jb-cl">${esc(c.text)}</div></div>`).join('')
    : '<div class="jb-noclue">❓ No peeking! It’s a total mystery.</div>');
  const ring = (s) => {
    const dur = Math.max(1, s.dur || 1), gone = Math.max(0, dur - (s.endsIn || 0));
    return `<div class="jb-ring st${s.stage}"><svg viewBox="0 0 120 120"><circle class="bg" cx="60" cy="60" r="54"/><circle class="fg" cx="60" cy="60" r="54" style="animation-duration:${dur}ms;animation-delay:-${gone}ms"/></svg><b data-jb-ends="${endsAt(s.endsIn)}">${Math.ceil((s.endsIn || 0) / 1000)}</b></div>`;
  };
  const chip = (name, color) => `<span class="jb-chip" style="--c:${esc(color || '#ffd23f')}">${esc(name)}</span>`;
  const itemCard = (it, fresh, small) => `<div class="jb-item r-${esc(it.r)} ${it.jackpot ? 'jack' : ''} ${fresh ? 'fresh' : ''} ${small ? 'sm' : ''}">
      <div class="jb-ie">${esc(it.emoji)}</div><div class="jb-in">${esc(it.name)}</div>
      <div class="jb-ir">${it.jackpot ? '💥 JACKPOT' : RAR[it.r]}</div><div class="jb-iv">${money(it.value)}</div>
      ${it.setIcon && !small ? `<div class="jb-iset">${esc(it.setIcon)} ${esc(it.setLabel)}</div>` : ''}</div>`;

  function unit(s, lift) {
    const L = s.locker;
    return `<div class="jb-unit" style="--door:${esc(L.door)}">
      <div class="jb-sign"><span>#${s.round}</span> ${esc(L.themeIcon)} ${esc(L.theme)}</div>
      <div class="jb-inside"><div class="jb-beam"></div><div class="jb-clues">${clueHtml(L)}</div></div>
      <div class="jb-door ${lift}"><span class="jb-handle"></span></div></div>`;
  }

  function tvAuction(s) {
    const L = s.locker, h = s.high;
    const top = (s.top || []).map((b, i) => `<div class="jb-top3 p${i}"><span>${['🥇', '🥈', '🥉'][i]}</span>${chip(b.name, b.color)}<b>${money(b.amount)}</b></div>`).join('');
    const tick = (s.ticker || []).map((b, i) => `<div class="jb-tk ${i === 0 && once('tk:' + s.round + ':' + s.bidCount) ? 'new' : ''}">${chip(b.name, b.color)}<b>${money(b.amount)}</b></div>`).join('');
    const hot = once('hb:' + s.round + ':' + s.bidCount);
    return `<div class="jb-floor">${unit(s, 'part')}
      <div class="jb-desk">
        <div class="jb-patter"><span class="jb-mic">🎙️</span><span>${esc(patter(s))}</span></div>
        <div class="jb-bidbox st${s.stage}">
          ${ring(s)}
          <div class="jb-cur"><small>${h ? 'Current bid' : 'Opening bid'}</small><div class="jb-amt ${hot && h ? 'bump' : ''}">${money(h ? h.amount : L.opening)}</div>
          <div class="jb-who">${h ? chip(h.name, h.color) : '<span class="muted">No bids yet</span>'}</div></div>
        </div>
        ${s.stage ? `<div class="jb-going st${s.stage}">${STAGE[s.stage]}</div>` : ''}
        <div class="jb-top3s">${top}</div>
        <div class="jb-ticker">${tick || '<div class="muted">📱 Bid on your phone!</div>'}</div>
        <div class="jb-meta">${s.bidders || 0} bidder${s.bidders === 1 ? '' : 's'} · ${s.bidCount} bid${s.bidCount === 1 ? '' : 's'}${s.inspectCount ? ` · 🔦 ${s.inspectCount} peeked` : ''}</div>
      </div></div>`;
  }
  function tvPreview(s) {
    const fresh = once('door:' + s.round);
    const L = s.locker;
    return `<div class="jb-floor">${unit(s, fresh ? 'part opening' : 'part')}
      <div class="jb-desk"><div class="jb-patter"><span class="jb-mic">🎙️</span><span>${esc(patter(s))}</span></div>
        <div class="jb-intro">${kindPill(L) || '<span class="jb-pill">🚪 Storage Locker</span>'}
          <h2>${esc(L.themeIcon)} ${esc(L.theme)}</h2>
          <p>${L.kind === 'sealed' ? '🔒 One secret bid each. Highest wins, pays the second-highest + $10.' : L.kind === 'mystery' ? '🎲 No clues at all. Feeling lucky?' : L.kind === 'premium' ? '💎 Better stuff, higher opening bid.' : L.kind === 'grand' ? '👑 The final locker: DOUBLE the stuff!' : 'Read the clues. Clues can lie!'}</p>
          <div class="jb-opening">Opening bid <b>${money(L.opening)}</b> · about ${L.size} things inside</div>
          <div class="jb-soon">Bidding opens in <b data-jb-ends="${endsAt(s.endsIn)}">${Math.ceil(s.endsIn / 1000)}</b></div>
          ${s.inspectors.length ? `<div class="jb-flashers">🔦 ${s.inspectors.map((n) => esc(n)).join(', ')} shone a flashlight…</div>` : '<div class="jb-flashers muted">🔦 Pay a little to peek with your flashlight!</div>'}
        </div></div></div>`;
  }
  function tvSealed(s) {
    const L = s.locker;
    return `<div class="jb-floor">${unit(s, 'part')}
      <div class="jb-desk"><div class="jb-patter"><span class="jb-mic">🎙️</span><span>Envelopes, please! One secret bid each. No take-backs!</span></div>
        <div class="jb-sealbox"><div class="jb-env">✉️</div><h2>Sealed Bid</h2>
          <p>Highest bid wins and pays the <b>second-highest + $10</b>.</p>
          <div class="jb-opening">Minimum <b>${money(L.opening)}</b></div>
          <div class="jb-envs">${'✉️'.repeat(Math.min(s.sealedIn || 0, 24))}${(s.sealedIn || 0) > 24 ? ' …' : ''}</div>
          <div class="jb-meta">${s.sealedIn} / ${s.eligible} envelopes in · ⏱ <b data-jb-ends="${endsAt(s.endsIn)}">${Math.ceil(s.endsIn / 1000)}</b>s</div>
          ${(s.sealWaiting || []).length ? `<div class="jb-sealwait">⏳ Waiting on ${s.sealWaiting.map((n) => `<b>${esc(n)}</b>`).join(', ')}</div>` : ''}</div></div></div>`;
  }
  function tvSold(s) {
    const sale = s.sale, fresh = once('sold:' + s.round);
    return `<div class="jb-floor">${unit(s, 'part')}
      <div class="jb-desk"><div class="jb-soldbox ${fresh ? 'fresh' : ''}">
        ${sale ? `<div class="jb-gavel">🔨</div><div class="jb-stamp">SOLD!</div><div class="jb-soldto">to ${chip(sale.name, sale.color)}</div><div class="jb-soldfor">for <b>${money(sale.price)}</b>${sale.sealed ? ' <small>(sealed bid, second price)</small>' : ''}</div>`
    : '<div class="jb-gavel">🦗</div><div class="jb-stamp grey">NO SALE</div><div class="jb-soldfor">Nobody bid! Let’s see what you all missed…</div>'}
      </div></div></div>`;
  }
  function tvReveal(s) {
    const R = s.reveal, sale = s.sale;
    const cards = R.items.map((it, i) => itemCard(it, once('it:' + s.round + ':' + i), R.size > 8)).join('');
    const hidden = Array.from({ length: R.size - R.items.length }, () => '<div class="jb-item box"><div class="jb-ie">📦</div></div>').join('');
    let foot = `<div class="jb-sofar">Unpacked so far: <b>${money(R.sofar)}</b>${sale ? ` · paid <b>${money(sale.price)}</b>` : ''}</div>`;
    if (R.done) {
      const r = R.result, fresh = once('res:' + s.round);
      foot = sale ? `<div class="jb-result ${r.profit >= 0 ? 'win' : 'lose'} ${fresh ? 'fresh' : ''}"><small>Worth ${money(r.total)} · paid ${money(r.price)}</small><div class="jb-pl">${r.profit >= 0 ? 'PROFIT' : 'LOSS'} ${signed(r.profit)}</div></div>`
        : `<div class="jb-result miss ${fresh ? 'fresh' : ''}"><small>Nobody bought it…</small><div class="jb-pl">You all missed ${money(r.total)}!</div></div>`;
      foot += R.news.map((n, i) => `<div class="jb-setnews" style="--d:${0.8 + i * 0.4}s">${esc(n.icon)} <b>${esc(n.name)}</b> completed <b>${esc(n.label)}</b>! <span>+${money(n.amount)}</span></div>`).join('');
    }
    return `<div class="jb-reveal"><div class="jb-revhead">${sale ? `🔨 ${chip(sale.name, sale.color)}’s locker` : '🦗 The unsold locker'} · ${esc(s.locker.themeIcon)} ${esc(s.locker.theme)}</div>
      <div class="jb-items ${R.size > 8 ? 'many' : ''}">${cards}${hidden}</div>${foot}</div>`;
  }
  function tvOver(s) {
    const w = s.final[0], top = Math.max(1, ...s.final.map((r) => r.net));
    const bars = s.final.slice(0, 6).map((r, i) => `<div class="jb-bar"><span class="n">${i + 1}</span><span class="nm">${esc(r.name)}${r.loans ? ' 🏦'.repeat(r.loans) : ''}</span>
      <span class="tr"><i style="width:${Math.max(2, (Math.max(0, r.net) / top) * 100)}%;--c:${esc(r.color)}"></i></span><b>${money(r.net)}</b>
      <small>💵${money(r.cash)} · 📦${money(r.itemValue)}${r.bonus ? ` · 🧩${money(r.bonus)}` : ''}${r.debt ? ` · 🏦−${money(r.debt)}` : ''}</small></div>`).join('');
    const pod = [s.final[1], s.final[0], s.final[2]];
    const podium = `<div class="jb-podium">${pod.map((r, i) => (r ? `<div class="pd p${[2, 1, 3][i]}"><div class="who">${r.av ? esc(r.av) : ['🥈', '🏆', '🥉'][i]}</div><div class="nm">${esc(r.name)}</div><div class="blk"><b>${[2, 1, 3][i]}</b><small>${money(r.net)}</small></div></div>` : '<div class="pd"></div>')).join('')}</div>`;
    return `<div class="jb-root jb-over final"><div class="jb-overhost"><div class="st-slot"></div></div><div class="muted">Storage tycoon of the night</div>${podium}<div class="jb-winner">🏆 ${esc(w ? w.name : '')} wins!</div>
      <div class="jb-awards">${(s.awards || []).slice(0, 6).map((a) => `<div class="jb-award"><div class="ic">${a.icon}</div><b>${esc(a.title)}</b><div>${esc(a.name)}</div><small class="muted">${esc(a.why)}</small></div>`).join('')}</div>
      <div class="jb-bars">${bars}</div><p class="muted">Net worth = cash + item values + set bonuses − loans with 20% interest</p></div>`;
  }
  const side = (s) => `<aside class="jb-side"><div class="st-slot"></div><div class="panel"><h3>💰 Net worth</h3>${s.standings.map((r, i) => `<div class="jb-row"><span class="n">${i + 1}</span><span class="dot" style="background:${esc(r.color)}"></span><span class="nm">${esc(r.name)}${r.loans ? ` <span title="loans">${'🏦'.repeat(r.loans)}</span>` : ''}</span><b>${money(r.net)}</b></div>`).join('')}
    ${s.players > s.standings.length ? `<div class="muted jb-more">+${s.players - s.standings.length} more bidders</div>` : ''}</div></aside>`;

  // Confetti for jackpots and legendary finds (TV only).
  function rain(chars, n = 40) {
    const box = document.createElement('div'); box.className = 'jb-rain';
    for (let i = 0; i < n; i++) { const sp = document.createElement('span'); sp.textContent = chars[i % chars.length]; sp.style.left = Math.random() * 100 + '%'; sp.style.animationDelay = Math.random() * 1.2 + 's'; sp.style.fontSize = 24 + Math.random() * 30 + 'px'; box.appendChild(sp); }
    document.body.appendChild(box); setTimeout(() => box.remove(), 4200);
  }

  // ---- Phone state that survives re-renders ----
  let draft = '', draftKey = '', showCol = false, wasHigh = false, sealDraft = '';

  function collection(v) {
    const c = v.collection;
    if (!showCol) return `<button class="btn ghost jb-wide" id="jb-col">🧩 My collection · ${c.items.length} item${c.items.length === 1 ? '' : 's'} · ${money(c.value)}</button>`;
    const sets = c.sets.length ? c.sets.map((s) => `<div class="jb-setrow ${s.done ? 'done' : ''}"><span>${esc(s.icon)} ${esc(s.label)}</span><span class="jb-pips">${'●'.repeat(s.n)}${'○'.repeat(3 - s.n)}</span><b>${s.done ? '✅ +' + money(s.bonus) : '+' + money(s.bonus)}</b></div>`).join('') : '<p class="muted">Collect 3 items from the same set for a bonus!</p>';
    const items = c.items.map((it) => `<div class="jb-mini r-${esc(it.r)}"><span>${esc(it.emoji)}</span><span class="nm">${esc(it.name)}</span><b>${money(it.value)}</b></div>`).join('');
    return `<div class="card-box jb-colbox"><div class="jb-colhead"><h3>🧩 My collection</h3><button class="btn small ghost" id="jb-col">Close</button></div>
      <div class="muted">Items ${money(c.value)} · set bonuses ${money(c.bonus)}</div>${sets}<div class="jb-minis">${items || '<p class="muted">Nothing yet. Win a locker!</p>'}</div></div>`;
  }
  function tools(v) {
    const ins = v.inspect, out = [];
    if (ins) {
      if (ins.result) {
        const r = ins.result;
        out.push(`<div class="jb-peek">🔦 ${r.type === 'rarity' ? `You spotted something <b class="rt r-${esc(r.r)}">${esc(r.label)}</b> in there.` : `The best thing inside is worth <b>${money(r.lo)}${r.hi ? '–' + money(r.hi) : '+'}</b>.`}</div>`);
      } else out.push(`<button class="btn cyan jb-tool" id="jb-insp">🔦 Flashlight peek <small>${money(ins.fee)}</small></button>`);
    }
    if (v.loansOn && v.loans < v.maxLoans) out.push(`<button class="btn ghost jb-tool" id="jb-loan" ${v.canLoan ? '' : 'disabled'}>🏦 Loan +${money(v.loanAmt)} <small>${v.canLoan ? `repay ${money(v.loanAmt * 1.2)}` : `under ${money(v.loanLine)}`}</small></button>`);
    return out.length ? `<div class="jb-tools">${out.join('')}</div>` : '';
  }
  function head(v) {
    return `<div class="jb-me"><span>💵 <b>${money(v.cash)}</b>${v.loans ? ` <span class="jb-debt">🏦${v.loans}</span>` : ''}</span><span>Net ${money(v.net)} · #${v.rank || '-'}/${v.of}</span><span class="muted">${v.round}/${v.rounds}</span></div>`;
  }
  function phoneAuction(v) {
    const h = v.high, me = v.me;
    let status = '<div class="jb-status none">💸 Make a bid!</div>';
    if (me.high) status = '<div class="jb-status win">✅ You’re winning!</div>';
    else if (me.best != null) status = `<div class="jb-status lose">⚠️ Outbid! <small>You were #${me.pos} of ${me.of}</small></div>`;
    const btns = v.adds.map((a) => `<button class="jb-bidbtn a${a.add}" data-add="${a.add}" ${me.high || a.amount > v.cash ? 'disabled' : ''}>+$${a.add}<small>bid ${money(a.amount)}</small></button>`).join('');
    return `${status}<div class="jb-pcur ${v.stage ? 'st' + v.stage : ''}"><small>${h ? esc(h.name) : 'Opening bid'}</small><b>${money(h ? h.amount : v.locker.opening)}</b>
      <span class="jb-psec">${v.stage ? STAGE[v.stage] : ''} ⏱ <b data-jb-ends="${endsAt(v.endsIn)}">${Math.ceil(v.endsIn / 1000)}</b></span></div>
      <div class="jb-bids">${btns}</div>
      <div class="jb-custom"><span>$</span><input id="jb-amt" type="number" inputmode="numeric" min="0" step="10" placeholder="min ${money(v.minBid)}"><button class="btn green" id="jb-go" ${me.high ? 'disabled' : ''}>Bid</button></div>`;
  }

  BOX.games.bid = {
    // Soundtrack cue per phase (public/box/scores/<key>.js); the TV turns the last 10 s of 'think' tense.
    music: (s) => ({ preview: 'think', auction: 'play', sealed: 'tense', sold: 'reveal', reveal: 'reveal', over: 'finale' }[s.phase] || 'play'),
    name: 'JustBid', icon: '🚪',
    about: 'Storage locker auctions! Peek at the clues, bid live against everyone, then watch the locker get unpacked. Treasure or trash?',
    how: [
      'A storage locker rolls onto the TV with its door half up. You get 3 peeks inside, but clues can lie (a box labeled VINTAGE can be junk).',
      'Bid live on your phone: +$10, +$25, +$100, +$500 or any amount. Every new bid restarts “Going once… going twice… SOLD!”',
      'Shine your 🔦 flashlight (5% of your cash, min $25) to privately learn the rarity of one hidden item or how much the best item is worth.',
      'The winner’s locker is unpacked item by item: Junk, Common, Good, Rare, Epic, LEGENDARY. Profit or loss?',
      'Collect 3 items from the same set for a bonus. Broke? Take a 🏦 bank loan (max 2), repaid with 20% interest at the end.',
      'Special lockers: 🔒 Sealed Bid (second price), 🎲 Mystery (no clues), 💎 Premium, and the 👑 Grand Locker finale. Highest net worth wins!',
    ],
    fx: {
      door: 'whoosh', open: 'gavel', bid: 'click', once: 'tick', twice: 'heartbeat', sold: 'gavel', nosale: 'shrug', withdrawn: 'gasp',
      envelope: 'ballot', flash: 'unlock', loan: 'chime', rollup: 'reveal', tension: 'drum',
      itemJ: 'poof', itemC: 'pop', itemG: 'flip', itemR: 'chime', itemE: 'swell', itemL: 'win', jackpot: 'cheer',
      profit: 'cheer', loss: 'boo', missed: 'shrug', set: 'win', premium: 'sting', mystery: 'shuffle', sealed: 'ballot', grand: 'swell', over: 'win',
    },
    onFx(f) {
      if (f.kind === 'jackpot') rain(['💰', '💎', '✨', '🤑', '💵']);
      else if (f.kind === 'itemL') rain(['✨', '⭐', '💛'], 28);
      else if (f.kind === 'set') rain(['🧩', '✨'], 18);
      // Rusty Rattlebang and the studio audience react.
      if (!F) return;
      const s = last || {}, sale = s.sale, pick = (a) => a[Math.floor(Math.random() * a.length)];
      const R = (o) => F.react(o);
      switch (f.kind) {
        case 'door': R({ line: pick(['Fresh locker comin’ in! Take a peek, folks!', 'Ooh, what’s behind this door?', 'Step right up and eyeball this one!']), pose: 'point', mood: 'clap', prio: 2 }); break;
        case 'premium': R({ line: 'A premium locker! Fancy stuff, folks!', pose: 'point', mood: 'gasp', prio: 3 }); break;
        case 'mystery': R({ line: 'A mystery locker! No clues, no mercy!', pose: 'shrug', mood: 'gasp', prio: 3 }); break;
        case 'sealed': R({ line: 'Sealed bids! Envelopes, please!', pose: 'point', prio: 3 }); break;
        case 'grand': R({ line: 'The GRAND locker! Double the stuff!', pose: 'cheer', mood: 'cheer', prio: 3 }); break;
        case 'open': R({ line: 'Biddin’ is OPEN! Who’ll start me off?', pose: 'gavel', poseMs: 700, mood: 'clap', prio: 2 }); break;
        case 'bid': R({ pose: 'point', poseMs: 600, mood: 'clap', moodMs: 900, prio: 0 }); break;
        case 'once': R({ line: 'Going once…', pose: 'gavel', poseMs: 300, prio: 1 }); break;
        case 'twice': R({ line: 'Going twice!', pose: 'gavel', poseMs: 300, mood: 'gasp', moodMs: 1500, prio: 2 }); break;
        case 'sold': R({ line: `SOLD! To ${f.name || (sale && sale.name) || 'our bidder'} for ${money(f.price != null ? f.price : sale && sale.price)}!`, pose: 'gavel', poseMs: 700, mood: 'cheer', prio: 3 }); break;
        case 'nosale': R({ line: 'No takers? Not even a nibble!', pose: 'shrug', mood: 'groan', prio: 3 }); break;
        case 'rollup': R({ line: 'Let’s see what’s inside!', pose: 'point', mood: 'gasp', moodMs: 1500, prio: 2 }); break;
        case 'tension': R({ line: 'Ooh, something shiny back there…', pose: 'point', mood: 'gasp', moodMs: 1700, prio: 2 }); break;
        case 'itemL': R({ line: 'LEGENDARY! Would you look at that!', pose: 'cheer', mood: 'cheer', confetti: true, prio: 3 }); break;
        case 'itemE': R({ line: 'Ooh, an epic find!', mood: 'clap', prio: 1 }); break;
        case 'itemJ': R({ mood: 'groan', moodMs: 1200, prio: 0 }); break;
        case 'jackpot': R({ line: 'JACKPOT, partner! Jackpot!', pose: 'cheer', mood: 'cheer', confetti: true, prio: 3 }); break;
        case 'profit': R({ line: `Cha-ching! ${(sale && sale.name) || 'Our bidder'} turns a profit!`, pose: 'cheer', mood: 'cheer', confetti: true, prio: 3 }); break;
        case 'loss': R({ line: pick(['Oof! That one’s a money pit!', 'Ouch! Paid too much, partner!']), pose: 'shrug', mood: 'groan', prio: 3 }); break;
        case 'missed': R({ line: 'Y’all missed out on that one!', pose: 'shrug', mood: 'groan', prio: 3 }); break;
        case 'over': { const w = (s.final || [])[0]; R({ line: `What a night! ${w ? w.name : 'Our winner'} is the storage tycoon!`, pose: 'cheer', mood: 'cheer', moodMs: 5000, confetti: true, prio: 4 }); break; }
        default:
      }
    },

    tv(el, s) {
      if (!s) return;
      newGame(s.round);
      // The auction runs inside a TV studio: the warehouse set behind, Rusty at his podium, the audience below.
      F = BOX.studio ? BOX.studio.frame(el, 'bid') : null; last = s;
      if (F) el = F.content;
      if (s.phase === 'over') { paint(el, sigOf(s), tvOver(s)); if (F) F.attach(); return; }
      if (!s.locker) return;
      let main = '';
      if (s.phase === 'preview') main = tvPreview(s);
      else if (s.phase === 'auction') main = tvAuction(s);
      else if (s.phase === 'sealed') main = tvSealed(s);
      else if (s.phase === 'sold') main = tvSold(s);
      else if (s.phase === 'reveal') main = tvReveal(s);
      paint(el, sigOf(s), `<div class="jb-root jb-tv"><section class="jb-stage"><div class="jb-lights">${'<i></i>'.repeat(7)}</div>
        <div class="jb-top"><span class="jb-logo">🚪 JustBid</span>${kindPill(s.locker)}<span class="jb-round">Locker ${s.round} of ${s.rounds}</span></div>${main}</section>${side(s)}</div>`);
      if (F) F.attach();
    },

    // The lobby is a storage locker: the door rolls up and every setting is an item inside.
    lobbyTv(el, L) {
      if (!BOX.studio) return;
      BOX.studio.lobby(el, L, { key: 'bid', title: '<span class="a">Just</span><span class="b">Bid</span>', tagline: 'Storage locker auctions! Bid live, unpack the loot. Treasure or trash?',
        icons: { rounds: '🚪', cash: '💵', countdown: '🔨', specials: '🎲', loans: '🏦', showIntro: '🎤' }, setTitle: 'UNIT 1 · House rules (click an item to change it)', joinTitle: 'Bidder check-in',
        startLabel: '🔨 Open the auction!', crowdTitle: 'bidders on the floor', emptyCrowd: 'No bidders yet… scan the tag to grab a paddle!', door: true });
    },

    phone(el, v, ctx) {
      if (!v) return;
      newGame(v.round);
      const k = v.round + ':' + v.phase;
      if (v.phase === 'auction') {
        // A little buzz when someone takes the lead from you.
        if (wasHigh && !v.me.high) { ctx.vibrate([60, 40, 60]); ctx.sfx('pop'); }
        wasHigh = v.me.high;
      } else wasHigh = false;
      if (draftKey !== k) { draftKey = k; draft = ''; sealDraft = ''; }
      if (v.phase === 'over') {
        const my = v.my || {};
        BOX.morph(el, `<div class="jb-root"><div class="card-box" style="text-align:center"><h3>Game over!</h3><p>You finished <b>#${v.rank}</b> of ${v.of}</p>
          <div class="jb-bignet">${money(v.net)}</div><div class="muted">💵 ${money(my.cash)} · 📦 ${money(my.itemValue)} · 🧩 ${money(my.bonus)}${my.debt ? ` · 🏦 −${money(my.debt)}` : ''}</div>
          ${v.awards.map((a) => `<div class="jb-myaward">${a.icon} <b>${esc(a.title)}</b><br><small class="muted">${esc(a.why)}</small></div>`).join('')}</div>
          <div class="card-box">${BOX.board(v.final, (r) => money(r.net), '')}</div>${collection(v)}</div>`);
        this.bind(el, v, ctx); return;
      }
      const L = v.locker; if (!L) return;
      const title = `<div class="jb-ptitle">${L.kind !== 'normal' ? `<span class="jb-pill k-${esc(L.kind)}">${L.kindIcon} ${esc(L.kindLabel)}</span>` : ''}<b>${esc(L.themeIcon)} ${esc(L.theme)}</b></div>`;
      let body = '';
      if (v.waiting) body = '<div class="big-status">👋 You’re in! You join the bidding from the next locker.</div><p class="muted" style="text-align:center">Watch the TV in the meantime.</p>';
      else if (v.phase === 'preview') {
        body = `<div class="jb-pclues">${clueHtml(L, 'sm')}</div><div class="big-status">Bidding opens in <b data-jb-ends="${endsAt(v.endsIn)}">${Math.ceil(v.endsIn / 1000)}</b></div>
          <p class="muted" style="text-align:center">${L.kind === 'sealed' ? '🔒 Sealed bid: one secret bid each.' : `Opening bid ${money(L.opening)}`}</p>${tools(v)}`;
      } else if (v.phase === 'auction') body = phoneAuction(v) + tools(v) + `<div class="jb-pclues tiny">${clueHtml(L, 'sm')}</div>`;
      else if (v.phase === 'sealed') {
        body = v.mySealed != null ? `<div class="jb-status win">✉️ Sealed! Your secret bid: ${money(v.mySealed)}</div><p class="muted" style="text-align:center">Waiting for the other envelopes… ⏱ <b data-jb-ends="${endsAt(v.endsIn)}">${Math.ceil(v.endsIn / 1000)}</b></p>`
          : `<div class="jb-status none">🔒 One secret bid. Highest wins, pays 2nd-highest + $10.</div>
            <div class="jb-pclues">${clueHtml(L, 'sm')}</div>
            <div class="jb-quick">${[1, 1.5, 2, 3, 5].map((m) => Math.round((L.opening * m) / 10) * 10).filter((a, i, arr) => a <= v.cash && arr.indexOf(a) === i).map((a) => `<button class="btn small ghost" data-q="${a}">${money(a)}</button>`).join('')}</div>
            <div class="jb-custom"><span>$</span><input id="jb-seal" type="number" inputmode="numeric" min="${L.opening}" step="10" placeholder="min ${money(L.opening)}"><button class="btn green" id="jb-sealgo">Seal it ✉️</button></div>
            <p class="muted" style="text-align:center">⏱ <b data-jb-ends="${endsAt(v.endsIn)}">${Math.ceil(v.endsIn / 1000)}</b>s</p>`;
        body += tools(v);
      } else if (v.phase === 'sold') {
        const s = v.sale;
        if (s && v.mine && once('won:' + v.round)) { ctx.sfx('win'); ctx.vibrate(200); }
        body = !s ? '<div class="big-status">🦗 No sale!</div>' : v.mine ? `<div class="jb-status win big">🎉 It’s yours for ${money(s.price)}!</div><p style="text-align:center">Watch the TV, it’s unpacking time!</p>`
          : `<div class="big-status">🔨 SOLD to ${esc(s.name)} for ${money(s.price)}</div>`;
      } else if (v.phase === 'reveal') {
        const R = v.reveal, s = v.sale;
        let res = '';
        if (R.done && R.result && s) {
          const p = R.result.profit;
          res = v.mine ? `<div class="jb-result sm ${p >= 0 ? 'win' : 'lose'}"><div class="jb-pl">${p >= 0 ? 'PROFIT' : 'LOSS'} ${signed(p)}</div></div>` : `<div class="muted" style="text-align:center">${esc(s.name)}: ${p >= 0 ? 'profit' : 'loss'} ${signed(p)}</div>`;
          if (v.mine && once('pl:' + v.round)) ctx.vibrate(p >= 0 ? 200 : [80, 60, 80]);
        }
        const news = R.done ? R.news.map((n) => `<div class="jb-setnews sm">${esc(n.icon)} ${esc(n.name)}: ${esc(n.label)} +${money(n.amount)}</div>`).join('') : '';
        body = `<div class="big-status">${v.mine ? '📦 Unpacking YOUR locker!' : '👀 Look at the TV!'}</div>
          <div class="jb-minis">${R.items.slice().reverse().map((it) => `<div class="jb-mini r-${esc(it.r)}"><span>${esc(it.emoji)}</span><span class="nm">${esc(it.name)}</span><b>${money(it.value)}</b></div>`).join('')}</div>
          <div class="jb-sofar sm">So far ${money(R.sofar)}${s ? ` · paid ${money(s.price)}` : ''}</div>${res}${news}`;
      }
      // Morph in place: bid buttons stay under fingers while the price climbs.
      BOX.morph(el, `<div class="jb-root jb-phone">${head(v)}${title}${body}${collection(v)}</div>`);
      this.bind(el, v, ctx);
    },

    bind(el, v, ctx) {
      const $ = (q) => el.querySelector(q);
      const col = $('#jb-col'); if (col) col.onclick = () => { showCol = !showCol; el.dataset.jbSig = ''; ctx.redraw(); };
      for (const b of el.querySelectorAll('[data-add]')) b.onclick = async () => {
        const r = await ctx.act({ op: 'bid', add: Number(b.dataset.add) });
        if (r && r.ok) { ctx.sfx('click'); ctx.vibrate(25); }
      };
      const amt = $('#jb-amt');
      if (amt) {
        amt.value = draft;
        amt.oninput = () => { draft = amt.value; };
        const go = async () => {
          const n = Math.round(Number(String(amt.value || draft).replace(/[$,\s]/g, '')));
          if (!Number.isFinite(n) || n <= 0) { ctx.toast('Type an amount first.'); return; }
          amt.blur();
          const r = await ctx.act({ op: 'bid', amount: n });
          if (r && r.ok) { draft = ''; amt.value = ''; ctx.sfx('click'); ctx.vibrate(30); }
        };
        amt.onkeydown = (e) => { if (e.key === 'Enter') go(); };
        $('#jb-go').onclick = go;
      }
      const seal = $('#jb-seal');
      if (seal) {
        seal.value = sealDraft;
        seal.oninput = () => { sealDraft = seal.value; };
        for (const q of el.querySelectorAll('[data-q]')) q.onclick = () => { sealDraft = q.dataset.q; seal.value = sealDraft; };
        const send = async () => {
          const n = Math.round(Number(String(seal.value || sealDraft).replace(/[$,\s]/g, '')));
          if (!Number.isFinite(n) || n <= 0) { ctx.toast('Type your secret bid first.'); return; }
          seal.blur();
          const r = await ctx.act({ op: 'sealed', amount: n });
          if (r && r.ok) { ctx.sfx('ballot'); ctx.vibrate(40); }
        };
        seal.onkeydown = (e) => { if (e.key === 'Enter') send(); };
        $('#jb-sealgo').onclick = send;
      }
      const insp = $('#jb-insp'); if (insp) insp.onclick = async () => { const r = await ctx.act({ op: 'inspect' }); if (r && r.ok) { ctx.sfx('unlock'); ctx.vibrate(30); } };
      const loan = $('#jb-loan'); if (loan) loan.onclick = async () => { const r = await ctx.act({ op: 'loan' }); if (r && r.ok) { ctx.sfx('chime'); ctx.toast(`🏦 +${money(v.loanAmt)} borrowed. Repay ${money(v.loanAmt * 1.2)} at the end.`); } };
    },
  };
})();
