'use strict';
// Blackjack Night: the dealer and every player's hand on the TV; bets and moves on the phone.
(function () {
  const { esc, card, timer } = BOX;
  const RESULT = { win: ['WIN', 'good'], blackjack: ['BLACKJACK!', 'good'], push: ['PUSH', 'meh'], lose: ['LOSE', 'bad'], bust: ['BUST', 'bad'] };
  let pending = 0, bust = null;

  function seat(x, size, phase) {
    const res = x.hands.map((h) => h.result).filter(Boolean);
    const status = phase === 'results' && x.net != null ? `<span class="bj-net ${x.net > 0 ? 'good' : x.net < 0 ? 'bad' : 'meh'}">${x.net > 0 ? '+' : ''}${x.net}</span>` : x.hands.some((h) => h.total > 21) ? '<span class="bj-net bad">BUST</span>' : x.hands.some((h) => h.bj) ? '<span class="bj-net good">BJ!</span>' : x.bet && phase === 'betting' ? `<span class="bj-bet">🪙 ${x.bet}</span>` : '';
    const hands = size === 'xs' ? x.hands.map((h) => `<span class="bj-tot">${h.total}</span>`).join(' ') : x.hands.map((h, i) => `<div class="bj-hand"><div class="cards fan">${h.cards.map((c, k) => card(c, { size: size === 'lg' ? 'sm' : 'xs', anim: 'bj' + x.id + i + k + c })).join('')}</div><span class="bj-tot">${h.total}</span></div>`).join('');
    return `<div class="bj-seat ${size} ${res.length && res.every((r) => r === 'bust' || r === 'lose') ? 'lost' : ''}"><div class="bj-name"><i style="background:${esc(x.color)}"></i>${esc(x.name)}${x.targeted ? ` <span title="Bust Bets on this player">🎯${x.targeted}</span>` : ''}</div>
      <div class="bj-row">${hands || '<span class="muted">—</span>'}${status}</div><div class="bj-chips">🪙 ${x.chips}</div></div>`;
  }

  BOX.games.blackjack = {
    name: 'Blackjack Night', icon: '🃏',
    about: 'Everyone plays against the dealer at the same time. Most chips after the last hand wins.',
    how: [
      'Place your bet on your phone before the timer runs out.',
      'Get closer to 21 than the dealer without going over. Face cards are 10, Aces are 1 or 11.',
      'Hit for another card, Stand to stop, Double to double your bet for one last card, Split a pair into two hands.',
      'Blackjack (an Ace and a 10-card) pays 3 to 2. The dealer draws to 17.',
      'Bust Bets: pay 25 chips to bet a friend goes bust. If they do, you get 75!',
      'Out of chips? You get 100 comeback chips so you can keep playing.',
    ],
    fx: { deal: 'deal', flip: 'flip', bust: 'boo', dealerBust: 'cheer', dealerBJ: 'sting', settle: 'chime', chip: 'ballot', shuffle: 'shuffle', win: 'win' },

    tv(el, s) {
      if (!s) return;
      if (s.phase === 'over') {
        const w = s.top[0];
        el.innerHTML = `<div class="final"><div class="crown">🪙</div><div class="muted">High roller of the night</div><h2>${esc(w ? w.name : '')}</h2><p>${w ? w.chips + ' chips' : ''}</p>${BOX.board(s.top, (r) => r.chips, ' 🪙')}</div>`;
        return;
      }
      const n = s.seats.length, size = n <= 8 ? 'lg' : n <= 24 ? 'md' : n <= 48 ? 'sm' : 'xs';
      const d = s.dealer;
      const msg = s.phase === 'betting' ? `Place your bets! ${timer(s.endsIn)}` : s.phase === 'playing' ? `Hit or stand? ${timer(s.endsIn)}` : s.phase === 'dealer' ? 'The dealer plays…' : s.last ? (s.last.note || (s.last.dealerBJ ? 'Dealer blackjack!' : s.last.dealer === 'bust' ? 'The dealer BUSTS! 🎉' : `Dealer stands on ${s.last.dealer}`)) : '';
      const bustNews = s.phase === 'results' && s.last && s.last.bustWins && s.last.bustWins.length ? `<div class="bj-news">🎯 Bust Bets paid: ${s.last.bustWins.map(esc).join(', ')}</div>` : '';
      el.innerHTML = `<div class="bj-top"><div class="bj-dealer"><div class="muted">Dealer · hand ${s.round} of ${s.totalHands}</div><div class="cards">${d.cards.map((c, i) => card(c, { size: 'lg', anim: 'dl' + s.round + i + c })).join('')}</div><div class="bj-dtot">${d.cards.length ? (d.hidden ? 'Shows ' + d.total : d.total) : ''}</div></div>
        <div class="bj-msg">${msg}${bustNews}</div>
        <aside class="panel bj-side"><h3 style="margin-top:0">Chip leaders</h3>${BOX.board(s.top.slice(0, 8), (r) => r.chips, ' 🪙')}</aside></div>
        <div class="bj-seats ${size}">${s.seats.sort((a, b) => a.rank - b.rank).map((x) => seat(x, size, s.phase)).join('')}</div>`;
    },

    phone(el, v, ctx) {
      if (!v) return;
      if (v.phase === 'over') { el.innerHTML = `<div class="card-box" style="text-align:center"><h3>Last hand played!</h3><p>You finished <b>#${v.rank}</b> of ${v.of} with <b>${v.chips}</b> chips.</p></div><div class="card-box">${BOX.board(v.final, (r) => r.chips, ' 🪙')}</div>`; return; }
      const head = `<div class="bj-me"><span class="bj-big">🪙 ${v.chips}</span><span class="muted">Hand ${v.round}/${v.totalHands} · #${v.rank} of ${v.of}${v.leader ? ' · leader ' + esc(v.leader.name) + ' ' + v.leader.chips : ''}</span></div>`;
      if (v.phase === 'betting') {
        if (v.bet) pending = v.bet;
        pending = Math.min(pending, v.chips);
        bust = v.bust;
        const chips = [10, 25, 100, 500].filter((c) => c <= v.chips);
        el.innerHTML = `${head}<div class="card-box"><h3>Place your bet ${timer(v.endsIn)}</h3>
          <div class="bj-pending">${pending ? '🪙 ' + pending : '<span class="muted">Tap chips to bet</span>'}</div>
          <div class="bj-chipbtns">${chips.map((c) => `<button class="chipbtn c${c}" data-add="${c}">${c}</button>`).join('')}</div>
          <div class="pr-btns"><button class="btn ghost small" id="bj-clear">Clear</button><button class="btn ghost small" id="bj-half">Half</button><button class="btn ghost small" id="bj-all">All in</button></div>
          <button class="btn big green" id="bj-bet" style="width:100%;margin-top:10px" ${pending >= v.minBet ? '' : 'disabled'}>${v.bet === pending && v.bet ? 'Bet placed ✓' : 'Bet ' + (pending || '')}</button></div>
          ${v.bustBets ? `<div class="card-box"><h3>🎯 Bust Bet <span class="muted" style="font-size:14px">${v.bustStake} chips, pays ${v.bustPays}</span></h3>
          <select id="bj-bust" style="width:100%;font:inherit;font-size:18px;padding:10px;border-radius:12px;background:#2b1c58;color:#fff;border:2px solid rgba(255,255,255,.2)"><option value="">No Bust Bet</option>${v.others.map((o) => `<option value="${esc(o.id)}" ${bust === o.id ? 'selected' : ''}>${esc(o.name)} will bust</option>`).join('')}</select></div>` : ''}`;
        for (const b of el.querySelectorAll('[data-add]')) b.onclick = () => { pending = Math.min(v.chips, pending + Number(b.dataset.add)); ctx.sfx('ballot'); ctx.redraw(); };
        el.querySelector('#bj-clear').onclick = () => { pending = 0; ctx.redraw(); };
        el.querySelector('#bj-half').onclick = () => { pending = Math.max(v.minBet, Math.floor(v.chips / 2)); ctx.redraw(); };
        el.querySelector('#bj-all').onclick = () => { pending = v.chips; ctx.redraw(); };
        el.querySelector('#bj-bet').onclick = () => ctx.act({ op: 'bet', amount: pending });
        const bs = el.querySelector('#bj-bust'); if (bs) bs.onchange = () => ctx.act({ op: 'bust', on: bs.value || null });
        return;
      }
      pending = 0;
      const dealer = `<div class="bj-dsmall"><span class="muted">Dealer</span><div class="cards">${v.dealer.cards.map((c) => card(c, { size: 'sm' })).join('')}</div><b>${v.dealer.cards.length ? (v.dealer.hidden ? 'shows ' + v.dealer.total : v.dealer.total) : ''}</b></div>`;
      if (!v.hands.length) { el.innerHTML = `${head}${dealer}<div class="card-box"><p>You’re sitting this hand out. Bet next hand!</p></div>`; return; }
      const hands = v.hands.map((h, i) => `<div class="card-box bj-myhand ${i === v.active && v.phase === 'playing' ? 'active' : ''}"><div class="cards">${h.cards.map((c, k) => card(c, { anim: 'me' + v.round + i + k + c })).join('')}</div>
        <div class="bj-myinfo"><b class="bj-big">${h.total}${h.soft ? ' (soft)' : ''}</b> <span class="muted">bet ${h.bet}${h.doubled ? ' (doubled)' : ''}</span> ${h.result ? `<span class="bj-net ${RESULT[h.result][1]}">${RESULT[h.result][0]}</span>` : h.total > 21 ? '<span class="bj-net bad">BUST</span>' : h.bj ? '<span class="bj-net good">BLACKJACK!</span>' : ''}</div></div>`).join('');
      let btns = '';
      if (v.phase === 'playing' && v.active >= 0) btns = `<div class="big-status">Your move ${timer(v.endsIn)}</div><div class="bj-moves"><button class="btn big green" data-op="hit">Hit</button><button class="btn big pink" data-op="stand">Stand</button>${v.canDouble ? '<button class="btn big cyan" data-op="double">Double</button>' : ''}${v.canSplit ? '<button class="btn big" data-op="split">Split</button>' : ''}</div>`;
      else if (v.phase === 'playing') btns = '<div class="big-status muted">Waiting for the others…</div>';
      else if (v.phase === 'dealer') btns = '<div class="big-status">The dealer plays… 👀</div>';
      else if (v.phase === 'results') btns = `<div class="big-status ${v.net > 0 ? 'good' : v.net < 0 ? 'bad' : ''}">${v.net > 0 ? 'You won ' + v.net + '! 🎉' : v.net < 0 ? 'You lost ' + -v.net : 'Push. Your chips are back.'}</div>${v.bustWon != null ? `<p style="text-align:center">🎯 ${v.bustWon ? 'Your Bust Bet on ' + esc(v.bustName) + ' paid ' + v.bustPays + '!' : 'Your Bust Bet on ' + esc(v.bustName) + ' missed.'}</p>` : ''}`;
      el.innerHTML = `${head}${dealer}${hands}${btns}`;
      for (const b of el.querySelectorAll('[data-op]')) b.onclick = () => { ctx.act({ op: b.dataset.op }); ctx.sfx('deal'); };
    },
  };
})();
