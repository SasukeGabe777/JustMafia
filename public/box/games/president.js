'use strict';
// President: TV shows every table (seats, card counts, the cards to beat); phones hold the hand.
(function () {
  const { esc, card, timer } = BOX;
  const TITLE_ICON = { president: '👑', vp: '🎩', citizen: '', vscum: '🧽', scum: '🧹' };
  const badge = (t, names) => (t ? `<span class="pr-title t-${t}">${TITLE_ICON[t]} ${esc(names[t])}</span>` : '');
  const POW = (c) => { const r = c.slice(0, -1); const i = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'].indexOf(r); return (i + 11) % 13; };
  let selected = new Set();

  function table(t, s, size) {
    const seats = t.seats.map((x) => `<div class="pr-seat ${t.turn === x.id ? 'turn' : ''} ${x.passed ? 'passed' : ''} ${x.place ? 'out' : ''}">
      <span class="dot" style="background:${esc(x.color || '#888')}"></span><span class="nm">${esc(x.name)}</span>
      ${x.place ? `<span class="place">#${x.place}</span>` : x.passed ? '<span class="tag">pass</span>' : `<span class="cnt">🂠 ${x.cards}</span>`}
      ${size !== 'xs' ? badge(x.title, s.titleNames) : (x.title === 'president' ? '👑' : x.title === 'scum' ? '🧹' : '')}</div>`).join('');
    const top = t.top ? `<div class="cards">${t.top.cards.map((c, i) => card(c, { size: size === 'xs' ? 'xs' : size === 'lg' ? 'lg' : 'sm', anim: 'pr' + t.id + c + t.top.name + i })).join('')}</div><div class="by">${esc(t.top.name)}</div>` : `<div class="lead muted">${t.done ? 'Table finished' : s.phase === 'trade' ? 'Trading cards…' : 'New trick'}</div>`;
    return `<div class="pr-table ${size} ${t.done ? 'done' : ''}"><div class="pr-th">${t.id === 0 && s.tables.length > 1 ? '👑 The Palace' : 'Table ' + (t.id + 1)}${t.turn ? ` <span class="muted">${timer(t.endsIn)}</span>` : ''}</div>
      <div class="pr-felt">${top}</div><div class="pr-seats">${seats}</div></div>`;
  }

  BOX.games.president = {
    name: 'President', icon: '👑',
    about: 'Climb from Scum to President. First to get rid of their cards rules the next round.',
    how: [
      'Play a single, pair, triple or four of a kind. The next player must beat it with the same number of cards.',
      '3 is the lowest card. Then 4 … K, A, and 2 is the highest.',
      'Can’t (or won’t) beat it? Pass. When everyone passes, the last player to play starts a new trick.',
      'First out is President, last is Scum. Next round the Scum hands over their two best cards!',
      'Big group? Several tables play at once. Presidents move up a table, Scums move down.',
    ],
    fx: { card: 'deal', big: 'flip', clear: 'poof', out: 'cheer', tableDone: 'chime', shuffle: 'shuffle', win: 'win' },

    tv(el, s) {
      if (!s) return;
      const n = s.tables.length, size = n === 1 ? 'lg' : n <= 4 ? 'md' : n <= 9 ? 'sm' : 'xs';
      const head = s.phase === 'over' ? '' : `<div class="banner">Round ${s.round} of ${s.rounds} · ${s.phase === 'trade' ? 'Trading cards ' + timer(s.endsIn) : s.phase === 'break' ? 'Next round in ' + timer(s.endsIn) : 'Beat the cards on the table!'}</div>`;
      if (s.phase === 'over') {
        const w = s.standings[0];
        el.innerHTML = `<div class="final"><div class="crown">👑</div><div class="muted">All hail the President</div><h2>${esc(w ? w.name : '')}</h2>${BOX.board(s.standings.map((x) => ({ name: x.name, points: x.points })), (r) => r.points, ' pts')}</div>`;
        return;
      }
      el.innerHTML = `${head}<div class="pr-wrap"><div class="pr-grid ${size}">${s.tables.map((t) => table(t, s, size)).join('')}</div>
        <aside class="panel pr-side"><h3 style="margin-top:0">Standings</h3>${BOX.board(s.standings, (r) => r.points, ' pts')}${s.waiting.length ? `<p class="muted">Dealt in next round: ${s.waiting.map(esc).join(', ')}</p>` : ''}</aside></div>`;
    },

    phone(el, v, ctx) {
      if (!v) return;
      if (v.phase === 'over') {
        el.innerHTML = `<div class="card-box" style="text-align:center"><h3>Game over!</h3><p>You finished <b>#${v.rank}</b> of ${v.of} with <b>${v.points}</b> points.</p></div><div class="card-box">${BOX.board(v.final, (r) => r.points, ' pts')}</div>`; return;
      }
      if (v.waiting) { el.innerHTML = '<div class="card-box"><h3>You’re in!</h3><p>You’ll be dealt in when the next round starts.</p></div>'; return; }
      const hand = v.hand, t = v.table;
      selected = new Set([...selected].filter((c) => hand.includes(c)));
      const head = `<div class="pr-me">${badge(v.title, v.titleNames) || '<span class="muted">No title yet</span>'}<span class="muted">Round ${v.round}/${v.rounds} · ${v.tables > 1 ? (v.tableNo === 1 ? '👑 The Palace' : 'Table ' + v.tableNo) + ' · ' : ''}#${v.rank} with ${v.points} pts</span></div>`;
      const others = `<div class="pr-others">${t.seats.map((x) => `<span class="${t.turn === x.id ? 'turn' : ''} ${x.passed ? 'passed' : ''}">${esc(x.name)} ${x.place ? '#' + x.place : x.passed ? 'pass' : x.cards}</span>`).join('')}</div>`;
      let action = '', topHtml = '';
      if (v.give) {
        action = `<div class="card-box"><h3>Give ${v.give.n} card${v.give.n > 1 ? 's' : ''} to ${esc(v.give.to)}</h3><p class="muted">They had to hand you their best: ${v.give.got.map((c) => card(c, { size: 'xs' })).join(' ')}. Pick ${v.give.n} card${v.give.n > 1 ? 's' : ''} to send back. ${timer(v.endsIn)}</p>
          <button class="btn big pink" id="pr-give" ${selected.size === v.give.n ? '' : 'disabled'}>Give ${selected.size}/${v.give.n}</button></div>`;
      } else if (v.phase === 'trade') {
        action = `<div class="big-status">Trading cards… ${timer(v.endsIn)}</div>${v.gave && !v.gave.back ? `<p class="muted" style="text-align:center">Your best ${v.gave.n > 1 ? v.gave.n + ' cards went' : 'card went'} to ${esc(v.gave.from)}.</p>` : ''}`;
      } else if (v.phase === 'break') {
        action = `<div class="big-status">Round over! Next round in ${timer(v.endsIn)}</div>`;
      } else if (t.done) {
        action = '<div class="big-status">Your table is done. Waiting for the other tables…</div>';
      } else {
        topHtml = t.top ? `<div class="pr-top"><div class="cards">${t.top.cards.map((c) => card(c, { size: 'sm' })).join('')}</div><div class="muted">by ${esc(t.top.name)} · beat it with ${t.top.cards.length === 1 ? 'one higher card' : t.top.cards.length + ' higher matching cards'}</div></div>` : `<div class="pr-top muted">${v.myTurn ? 'You lead: play any single, pair, triple or four of a kind.' : 'New trick'}</div>`;
        if (v.myTurn) {
          const sel = [...selected], ok = sel.length && sel.every((c) => c.slice(0, -1) === sel[0].slice(0, -1)) && (!t.top || (sel.length === t.top.cards.length && POW(sel[0]) > POW(t.top.cards[0])));
          action = `<div class="big-status turn-now">Your turn! ${timer(t.endsIn)}</div><div class="pr-btns"><button class="btn big green" id="pr-play" ${ok ? '' : 'disabled'}>Play ${sel.length || ''}</button>${t.top ? '<button class="btn big ghost" id="pr-pass">Pass</button>' : ''}</div>`;
        } else {
          const turn = t.seats.find((x) => x.id === t.turn);
          action = `<div class="big-status muted">${turn ? esc(turn.name) + '’s turn' : ''}</div>`;
        }
      }
      if (v.myTurn && !el.dataset.buzzed) { ctx.vibrate(120); el.dataset.buzzed = '1'; } else if (!v.myTurn) delete el.dataset.buzzed;
      el.innerHTML = `${head}${others}${topHtml}${action}<div class="pr-hand">${hand.map((c) => card(c, { sel: selected.has(c), attrs: 'data-pick' })).join('')}</div><p class="muted" style="text-align:center">Tap cards to select them. ${hand.length} cards left.</p>`;
      for (const c of el.querySelectorAll('[data-pick]')) c.onclick = () => {
        const id = c.dataset.card;
        if (selected.has(id)) selected.delete(id);
        else {
          // Picking a different rank starts a new selection (sets are always one rank).
          if (!v.give && [...selected].some((x) => x.slice(0, -1) !== id.slice(0, -1))) selected.clear();
          if (v.give && selected.size >= v.give.n) selected.delete([...selected][0]);
          selected.add(id);
        }
        ctx.redraw();
      };
      const play = el.querySelector('#pr-play'); if (play) play.onclick = async () => { const r = await ctx.act({ op: 'play', cards: [...selected] }); if (r.ok) { selected.clear(); ctx.sfx('deal'); } };
      const pass = el.querySelector('#pr-pass'); if (pass) pass.onclick = () => { ctx.act({ op: 'pass' }); selected.clear(); };
      const give = el.querySelector('#pr-give'); if (give) give.onclick = async () => { const r = await ctx.act({ op: 'give', cards: [...selected] }); if (r.ok) selected.clear(); };
    },
  };
})();
