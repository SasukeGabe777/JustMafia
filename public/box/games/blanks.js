'use strict';
// JustBlanks screens. TV: the black prompt card, the anonymous white answer cards, the winner.
// Phone: your hand (tap to pick, in order), write-your-own blank cards, judging / voting.
(function () {
  const { esc, timer } = BOX;
  let picked = [], writing = null, draft = '';
  const seen = new Set(); // answer cards already shown on the TV (animate each one only once)
  // Fill the prompt's blanks with the chosen answers (for the winner reveal).
  const fill = (prompt, cards) => { let i = 0; const out = esc(prompt).replace(/___/g, () => `<u>${esc(cards[i++] || '____')}</u>`); return i < cards.length ? out + ' <u>' + cards.slice(i).map(esc).join(' / ') + '</u>' : out; };
  const blank = (t) => esc(t).replace(/___/g, '<span class="bl-gap"></span>');
  const white = (cards, extra = '') => `<div class="bl-white ${extra}">${cards.map((c) => `<div>${esc(c)}</div>`).join('<hr>')}</div>`;

  BOX.games.blanks = {
    name: 'JustBlanks', icon: '🃏',
    about: 'Fill in the blank with the funniest card in your hand (or write your own). Anonymous answers, one winner a round.',
    how: [
      'A prompt card with a blank goes up on the big screen.',
      'Everyone plays the answer card from their phone that fills the blank best. Some prompts need two.',
      'Blank cards let you type your own answer.',
      'Answers show up on the TV with no names. The Judge picks the funniest (or everybody votes, in big groups).',
      'The winning card gets a point. First to the target wins!',
    ],
    fx: { deal: 'shuffle', card: 'deal', flip: 'flip', win1: 'cheer', win: 'win' },

    tv(el, s) {
      if (!s) return;
      if (s.phase === 'over') {
        const w = s.standings[0];
        el.innerHTML = `<div class="final"><div class="crown">🃏</div><div class="muted">Funniest person in the room</div><h2>${esc(w ? w.name : '')}</h2>${BOX.board(s.standings, (r) => r.points, ' pts')}</div>`; return;
      }
      const prompt = s.prompt ? `<div class="bl-black">${blank(s.prompt.text)}${s.prompt.pick > 1 ? `<span class="bl-pick">PICK ${s.prompt.pick}</span>` : ''}</div>` : '';
      let body = '';
      if (s.phase === 'pick') body = `<div class="bl-status">${s.judge ? `⚖️ <b>${esc(s.judge)}</b> is the Judge` : '🗳️ Everyone votes this round'} · ${s.played} played ${timer(s.endsIn)}</div><div class="bl-waiting">${s.waiting.length ? 'Waiting for: ' + s.waiting.slice(0, 20).map(esc).join(', ') + (s.waiting.length > 20 ? ` +${s.waiting.length - 20}` : '') : 'Everyone’s in!'}</div>`;
      else if (s.phase === 'reveal' || s.phase === 'choose') body = `<div class="bl-status">${s.phase === 'reveal' ? 'The answers are…' : s.judge ? `⚖️ ${esc(s.judge)} is choosing… ${timer(s.endsIn)}` : `🗳️ Vote on your phone! ${s.voted} voted ${timer(s.endsIn)}`}</div><div class="bl-grid n${Math.min(4, Math.ceil(s.answers.length / 3))}">${s.answers.map((a) => { const fresh = !seen.has(a.sid); seen.add(a.sid); return white(a.cards, fresh ? 'in' : ''); }).join('')}</div>`;
      else if (s.phase === 'win' && s.last) {
        body = s.last.none ? '<div class="bl-status">Nobody played a card. Next round!</div>'
          : `<div class="bl-win">${s.last.winners.map((w) => `<div class="bl-black big">${fill(s.prompt.text, w.cards)}</div><div class="bl-by">🏆 ${esc(w.name)}${s.last.votes ? ` · ${s.last.votes[w.sid] || 0} votes` : ''}${s.last.random ? ' (time ran out: picked at random)' : ''}</div>`).join('')}</div>`;
      }
      el.innerHTML = `<div class="bl-wrap"><section>${s.phase !== 'win' ? prompt : ''}${body}</section><aside class="panel"><h3 style="margin-top:0">Score <span class="muted">(first to ${s.toWin})</span></h3>${BOX.board(s.standings, (r) => r.points, '')}<p class="muted">Round ${s.round}</p></aside></div>`;
    },

    phone(el, v, ctx) {
      if (!v) return;
      if (v.phase === 'over') { el.innerHTML = `<div class="card-box" style="text-align:center"><h3>Game over!</h3><p>You finished <b>#${v.rank}</b> with ${v.points} point${v.points === 1 ? '' : 's'}.</p></div><div class="card-box">${BOX.board(v.final, (r) => r.points, '')}</div>`; return; }
      const head = `<div class="bl-me"><span>🏅 ${v.points} pt${v.points === 1 ? '' : 's'} · #${v.rank || '-'}</span><span class="muted">first to ${v.toWin}</span></div><div class="bl-black small">${blank(v.prompt ? v.prompt.text : '')}${v.prompt && v.prompt.pick > 1 ? `<span class="bl-pick">PICK ${v.prompt.pick}</span>` : ''}</div>`;
      if (v.phase === 'pick') {
        if (v.isJudge) { el.innerHTML = `${head}<div class="card-box" style="text-align:center"><h3>⚖️ You’re the Judge!</h3><p>Sit back. When the answers are in, you pick the funniest. ${timer(v.endsIn)}</p></div>`; return; }
        if (v.played) { el.innerHTML = `${head}<div class="big-status">Played! ✅</div>${white(v.mine)}<p class="muted" style="text-align:center">Waiting for everyone… ${timer(v.endsIn)}</p>`; picked = []; return; }
        const need = v.prompt.pick;
        picked = picked.filter((p) => p.w || v.hand.some((c) => c.id === p.id));
        const pos = (c) => picked.findIndex((p) => p.id === c.id);
        el.innerHTML = `${head}<div class="bl-pickinfo">Tap ${need > 1 ? need + ' cards in order' : 'a card'} · ${timer(v.endsIn)}</div>
          <div class="bl-hand">${v.hand.map((c) => { const k = pos(c); return `<button class="bl-card ${k >= 0 ? 'sel' : ''}" data-c="${esc(c.id)}">${k >= 0 && need > 1 ? `<span class="n">${k + 1}</span>` : ''}${esc(c.text)}</button>`; }).join('')}
          ${picked.filter((p) => p.w).map((p) => `<button class="bl-card sel written" data-w="${esc(p.id)}"><span class="n">${need > 1 ? picked.indexOf(p) + 1 : '✍️'}</span>${esc(p.text)}</button>`).join('')}</div>
          ${writing ? `<div class="card-box"><label class="muted">Write your own answer</label><input id="bl-write" class="dk-select" maxlength="70" value="${esc(draft)}" placeholder="something hilarious"><div class="pr-btns"><button class="btn small ghost" id="bl-wcancel">Cancel</button><button class="btn small" id="bl-wadd">Add card</button></div></div>`
            : `<div class="pr-btns">${v.blanks > 0 ? `<button class="btn ghost small" id="bl-blank">✍️ Write your own (${v.blanks >= 99 ? '∞' : v.blanks} left)</button>` : ''}${v.canSwap ? '<button class="btn ghost small" id="bl-swap">🔄 New hand (once)</button>' : ''}</div>`}
          <button class="btn big green" id="bl-play" style="width:100%" ${picked.length === need ? '' : 'disabled'}>Play ${picked.length}/${need}</button>`;
        for (const b of el.querySelectorAll('[data-c]')) b.onclick = () => { const id = b.dataset.c, k = picked.findIndex((p) => p.id === id); if (k >= 0) picked.splice(k, 1); else { if (picked.length >= need) picked.shift(); picked.push({ id }); } ctx.redraw(); };
        for (const b of el.querySelectorAll('[data-w]')) b.onclick = () => { picked = picked.filter((p) => p.id !== b.dataset.w); ctx.redraw(); };
        const bb = el.querySelector('#bl-blank'); if (bb) bb.onclick = () => { writing = true; ctx.redraw(); setTimeout(() => { const i = el.querySelector('#bl-write'); if (i) i.focus(); }, 50); };
        const sw = el.querySelector('#bl-swap'); if (sw) sw.onclick = () => { if (confirm('Throw away your hand for 7 new cards? (once per game)')) { picked = []; ctx.act({ op: 'swap' }); } };
        const wi = el.querySelector('#bl-write'); if (wi) wi.oninput = () => { draft = wi.value; };
        const wc = el.querySelector('#bl-wcancel'); if (wc) wc.onclick = () => { writing = null; draft = ''; ctx.redraw(); };
        const wa = el.querySelector('#bl-wadd'); if (wa) wa.onclick = () => { const t = (el.querySelector('#bl-write').value || '').trim(); if (!t) return; if (picked.length >= need) picked.shift(); picked.push({ id: 'w' + Date.now(), w: true, text: t }); writing = null; draft = ''; ctx.redraw(); };
        el.querySelector('#bl-play').onclick = async () => {
          const r = await ctx.act({ op: 'play', cards: picked.filter((p) => !p.w).map((p) => p.id), written: picked.filter((p) => p.w).map((p) => p.text), order: picked.map((p) => (p.w ? 'w' : 'c')) });
          if (r.ok) { picked = []; ctx.sfx('deal'); ctx.vibrate(30); }
        };
        return;
      }
      if (v.phase === 'reveal') { el.innerHTML = `${head}<div class="big-status">👀 Look at the big screen!</div>`; return; }
      if (v.phase === 'choose') {
        const judge = v.isJudge, voting = v.mode === 'vote';
        if (!judge && !voting) { el.innerHTML = `${head}<div class="big-status">⚖️ ${esc(v.judge)} is choosing…</div>`; return; }
        el.innerHTML = `${head}<div class="bl-pickinfo">${judge ? '⚖️ Pick the funniest answer!' : v.myVote ? 'Vote cast ✅ (tap another to change)' : '🗳️ Vote for the funniest (not your own)'} ${timer(v.endsIn)}</div>
          <div class="bl-answers">${v.answers.map((a) => `<button class="bl-ans ${v.myVote === a.sid ? 'sel' : ''} ${a.mine ? 'mine' : ''}" data-s="${esc(a.sid)}" ${a.mine && !judge ? 'disabled' : ''}>${a.cards.map(esc).join('<br>— ')}${a.mine ? '<small>your answer</small>' : ''}</button>`).join('')}</div>`;
        for (const b of el.querySelectorAll('[data-s]')) b.onclick = () => { ctx.act({ op: judge ? 'pick' : 'vote', sid: b.dataset.s }); ctx.vibrate(20); };
        return;
      }
      if (v.phase === 'win' && v.last && !v.last.none) {
        const won = v.last.winners.find((w) => v.mine && w.cards.join() === v.mine.join());
        el.innerHTML = `${head}<div class="card-box" style="text-align:center">${won ? '<h3>🏆 Your card won! +1</h3>' : `<h3>🏆 ${esc(v.last.winners.map((w) => w.name).join(' & '))} won the round</h3>`}${v.last.winners.map((w) => `<div class="bl-black small">${fill(v.prompt.text, w.cards)}</div>`).join('')}</div>`;
        if (won && el.dataset.won !== String(v.round)) { el.dataset.won = String(v.round); ctx.sfx('win'); ctx.vibrate(120); }
        return;
      }
      el.innerHTML = `${head}<div class="big-status">Next round coming…</div>`;
    },
  };
})();
