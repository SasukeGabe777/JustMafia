'use strict';
// Two Truths & a Lie screens. TV: who's in the hot seat and their three statements; after the
// vote, the lie is stamped and the votes are shown. Phone: type your three (mark the lie), vote.
(function () {
  const { esc, timer } = BOX;
  let draft = ['', '', ''], lie = null;

  BOX.games.truths = {
    name: 'Two Truths & a Lie', icon: '🤥',
    about: 'Type two true things and one lie about yourself. Can the room spot your lie?',
    how: [
      'Everyone types three things about themselves on their phone: two true, one lie. Mark the lie.',
      'One by one, a player’s three statements go up on the big screen.',
      'Talk it over, then everyone votes on their phone: which one is the lie?',
      'Guess right: +1 point. In the hot seat: +1 for every person you fool.',
    ],
    fx: { flip: 'flip', gavel: 'gavel', laugh: 'laugh', cheer: 'cheer', win: 'win' },

    tv(el, s) {
      if (!s) return;
      if (s.phase === 'over') {
        const w = s.standings[0];
        el.innerHTML = `<div class="final"><div class="crown">🤥</div><div class="muted">Master of deception</div><h2>${esc(w ? w.name : '')}</h2>${BOX.board(s.standings, (r) => r.points, ' pts')}</div>`; return;
      }
      let main;
      if (s.phase === 'write') {
        main = `<div class="tt-write"><div class="tt-big">✍️ Grab your phone!</div><p>Type <b>two truths</b> and <b>one lie</b> about yourself.</p><div class="tt-count">${s.written} / ${s.of} ready ${timer(s.endsIn)}</div>
          <div class="bl-waiting">${s.waiting.length ? 'Still writing: ' + s.waiting.slice(0, 24).map(esc).join(', ') : 'Everyone’s ready!'}</div></div>`;
      } else {
        const c = s.seat;
        const head = `<div class="tt-seat">🔥 In the hot seat: <b>${esc(c.name)}</b> <span class="muted">(${c.n} of ${c.total})</span></div>`;
        const status = s.phase === 'talk' ? `🗣️ Talk it over! Voting opens in ${timer(s.endsIn)}` : s.phase === 'vote' ? `🗳️ Vote on your phone! ${c.voted} voted ${timer(s.endsIn)}` : c.result.fooled > c.result.right ? `😈 ${esc(c.name)} fooled ${c.result.fooled}!` : `🕵️ ${c.result.right} spotted the lie!`;
        main = `${head}<div class="tt-status">${status}</div><div class="tt-items">${c.items.map((t, i) => {
          const isLie = c.lie === i, tally = c.result ? c.result.tally[i] : null;
          return `<div class="tt-item ${c.lie == null ? '' : isLie ? 'lie' : 'truth'}"><span class="num">${i + 1}</span><span class="txt">${esc(t)}</span>${c.lie == null ? '' : `<span class="stamp">${isLie ? 'LIE' : 'TRUE'}</span><span class="votes">${tally} vote${tally === 1 ? '' : 's'}</span>`}</div>`;
        }).join('')}</div>`;
      }
      el.innerHTML = `<div class="bl-wrap"><section>${main}</section><aside class="panel"><h3 style="margin-top:0">Score</h3>${BOX.board(s.standings, (r) => r.points, '')}</aside></div>`;
    },

    phone(el, v, ctx) {
      if (!v) return;
      if (v.phase === 'over') { el.innerHTML = `<div class="card-box" style="text-align:center"><h3>Game over!</h3><p>You finished <b>#${v.rank}</b> with ${v.points} point${v.points === 1 ? '' : 's'}.</p></div><div class="card-box">${BOX.board(v.final, (r) => r.points, '')}</div>`; return; }
      const head = `<div class="bl-me"><span>🏅 ${v.points} pt${v.points === 1 ? '' : 's'} · #${v.rank || '-'}</span></div>`;
      if (v.phase === 'write') {
        if (v.written) { el.innerHTML = `${head}<div class="big-status">Ready! ✅</div><div class="card-box">${v.mySet.items.map((t, i) => `<p>${i === v.mySet.lie ? '🤥' : '✅'} ${esc(t)}</p>`).join('')}</div><p class="muted" style="text-align:center">Keep your lie secret… ${timer(v.endsIn)}</p>`; return; }
        el.innerHTML = `${head}<div class="card-box"><h3>Two truths and a lie ${timer(v.endsIn)}</h3><p class="muted">Write three things about you. Tap 🤥 next to the one that’s a lie.</p>
          ${[0, 1, 2].map((i) => `<div class="tt-row"><input class="dk-select" data-i="${i}" maxlength="90" placeholder="${['I once…', 'I have never…', 'My weirdest talent is…'][i]}" value="${esc(draft[i])}"><button class="tt-liebtn ${lie === i ? 'on' : ''}" data-lie="${i}">🤥</button></div>`).join('')}
          <button class="btn big green" id="tt-send" style="width:100%;margin-top:10px">Lock it in</button></div>`;
        for (const inp of el.querySelectorAll('[data-i]')) inp.oninput = () => { draft[Number(inp.dataset.i)] = inp.value; };
        for (const b of el.querySelectorAll('[data-lie]')) b.onclick = () => { lie = Number(b.dataset.lie); for (const x of el.querySelectorAll('[data-lie]')) x.classList.toggle('on', Number(x.dataset.lie) === lie); };
        el.querySelector('#tt-send').onclick = async () => {
          for (const inp of el.querySelectorAll('[data-i]')) draft[Number(inp.dataset.i)] = inp.value;
          if (lie == null) return ctx.toast('Tap 🤥 next to your lie.');
          const r = await ctx.act({ op: 'write', items: draft, lie });
          if (r.ok) { ctx.sfx('chime'); draft = ['', '', '']; lie = null; }
        };
        return;
      }
      const c = v.seat; if (!c) { el.innerHTML = `${head}<div class="big-status">Get ready…</div>`; return; }
      if (c.mine && v.phase !== 'reveal') { el.innerHTML = `${head}<div class="card-box" style="text-align:center"><h3>🔥 You’re in the hot seat!</h3><p>Keep a straight face. ${v.phase === 'talk' ? 'Defend your statements!' : 'They’re voting now…'} ${timer(v.endsIn)}</p></div>`; return; }
      if (v.phase === 'talk') { el.innerHTML = `${head}<div class="tt-seat small">🔥 ${esc(c.name)}</div>${c.items.map((t, i) => `<div class="tt-item"><span class="num">${i + 1}</span><span class="txt">${esc(t)}</span></div>`).join('')}<div class="big-status">🗣️ Talk it over… ${timer(v.endsIn)}</div>`; return; }
      if (v.phase === 'vote') {
        el.innerHTML = `${head}<div class="tt-seat small">Which one is ${esc(c.name)}’s lie? ${timer(v.endsIn)}</div><div class="tt-votes">${c.items.map((t, i) => `<button class="tt-vote ${c.myVote === i ? 'sel' : ''}" data-v="${i}"><span class="num">${i + 1}</span>${esc(t)}</button>`).join('')}</div>${c.myVote != null ? '<p class="muted" style="text-align:center">Vote cast ✅ (tap another to change)</p>' : ''}`;
        for (const b of el.querySelectorAll('[data-v]')) b.onclick = () => { ctx.act({ op: 'vote', pick: Number(b.dataset.v) }); ctx.vibrate(20); };
        return;
      }
      if (v.phase === 'reveal') {
        const right = c.myVote === c.lie;
        el.innerHTML = `${head}<div class="card-box" style="text-align:center">${c.mine ? `<h3>😈 You fooled ${c.result.fooled}! +${c.result.fooled}</h3>` : c.myVote == null ? '<h3>You didn’t vote</h3>' : right ? '<h3>🕵️ You spotted it! +1</h3>' : '<h3>😵 Fooled!</h3>'}<p>The lie was: <b>${esc(c.items[c.lie])}</b></p></div>`;
      }
    },
  };
})();
