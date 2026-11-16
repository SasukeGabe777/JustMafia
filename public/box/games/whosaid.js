'use strict';
// Who Said It? screens. TV: the question, then each anonymous answer in the spotlight with the
// names to pick from; the reveal grows the vote bars and stamps the real author. End: awards.
// Phone: type your answer, guess who wrote each one (Double Down once a game), see your points.
(function () {
  const { esc, timer } = BOX;
  // The game's own stylesheet (prefixed ws-), loaded once on whichever page shows the game.
  if (!document.querySelector('link[data-ws-css]')) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/box/games/whosaid.css'; l.dataset.wsCss = '1';
    document.head.appendChild(l);
  }
  // Phone drafts survive re-renders (kept here, not in the DOM).
  let draft = '', draftKey = '', editing = false, qdraft = '', ddOn = false, ddKey = '';
  const seen = new Set(); // one-shot animations (each spotlight / reveal animates only once)
  const once = (k) => { if (seen.has(k)) return false; seen.add(k); if (seen.size > 400) seen.clear(); return true; };
  const endKey = (ms) => (ms ? Math.round((Date.now() + ms) / 4000) : 0);
  // Re-render only when something visible changed: animations don't restart, typing isn't lost.
  const paint = (el, sig, html) => { if (el.dataset.wsSig === sig && el.querySelector('.ws-root')) return false; el.dataset.wsSig = sig; el.innerHTML = html; return true; };
  const sigOf = (s, extra) => JSON.stringify({ ...s, endsIn: endKey(s.endsIn), x: extra || null });
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const scoreRows = (rows) => rows.map((r) => ({ ...r, name: r.name + (r.fire ? ' 🔥' : '') }));
  const mood = (r) => (r.bluff ? `🎭 <b>BLUFF BADGE!</b> Nobody guessed ${esc(r.name)}!` : r.voted === 0 ? `Nobody guessed. It was ${esc(r.name)}!`
    : r.right > r.fooled ? `📖 ${plural(r.right, 'person')} saw right through ${esc(r.name)}!` : `🕵️ ${esc(r.name)} fooled ${r.fooled}!`);

  function chips(sp, anim) {
    const r = sp.result, voted = r ? Math.max(1, r.voted) : 1;
    return `<div class="ws-names n${sp.names.length} ${r ? 'done' : ''} ${anim ? 'anim' : ''}">${sp.names.map((n, i) => {
      if (!r) return `<div class="ws-chip"><span class="ws-k">${'ABCD'[i]}</span><span class="ws-nm">${esc(n)}</span></div>`;
      const t = r.tally[i], pct = Math.round((t / voted) * 100), au = i === r.author;
      return `<div class="ws-chip ${au ? 'author' : 'other'}"><span class="ws-fill" style="--w:${pct}%"></span><span class="ws-k">${'ABCD'[i]}</span><span class="ws-nm">${esc(n)}</span><span class="ws-ct">${t}</span>${au ? '<span class="ws-stamp">✍️ WROTE IT</span>' : ''}</div>`;
    }).join('')}</div>`;
  }

  BOX.games.whosaid = {
    name: 'Who Said It?', icon: '🗣️',
    about: 'Everyone answers a question anonymously. Then guess who wrote each answer. How well do you really know each other?',
    how: [
      'A question goes up on the big screen. Everyone types an answer on their phone. Nobody sees whose is whose.',
      'Answers go into the spotlight one at a time. Pick who you think wrote it from the names on your phone.',
      'Right guess: +100 (+50 if you were one of the fastest). Three right in a row: 🔥 +50.',
      'Wrote it? Keep a poker face! You get +50 for everyone you fool, and a 🎭 Bluff badge if nobody guesses you.',
      'Once a game you can 🎲 Double Down: double points if you’re right, −50 if you’re wrong.',
    ],
    fx: { round: 'swell', in: 'pop', spot: 'whoosh', drum: 'drum', wall: 'chime', unlock: 'unlock', win: 'win' },
    onFx(f) {
      if (f.kind === 'drum') setTimeout(() => BOX.sfx(f.bluff ? 'gasp' : f.crowd ? 'cheer' : 'laugh'), 1400);
    },

    tv(el, s) {
      if (!s) return;
      if (s.phase === 'over') {
        const w = s.standings[0], a = once('over:' + (w ? w.id + w.points : ''));
        const awards = (s.awards || []).map((x, i) => `<div class="ws-award" style="--d:${0.5 + i * 0.35}s"><div class="ws-aw-ic">${x.icon}</div><div class="ws-aw-t">${esc(x.title)}</div><div class="ws-aw-n">${esc(x.name)}</div><div class="ws-aw-v">${esc(x.value)}</div><div class="ws-aw-b">${esc(x.blurb)}</div></div>`).join('');
        paint(el, sigOf(s), `<div class="ws-root ws-over ${a ? 'anim' : ''}"><div class="final"><div class="crown">🗣️</div><div class="muted">They know you best</div><h2>${esc(w ? w.name : '')}</h2>
          ${w ? `<div class="ws-win-pts">${w.points} pts</div>` : ''}</div>
          <div class="ws-awards">${awards}</div><div class="ws-final-board">${BOX.board(scoreRows(s.standings), (r) => r.points, ' pts')}</div></div>`);
        return;
      }
      const top = `<div class="ws-top"><span class="ws-pill">Round ${s.round} of ${s.rounds}</span>${s.custom ? `<span class="ws-pill gold">👑 Asked by ${esc(s.host || 'the host')}</span>` : ''}</div>`;
      let main = '';
      if (s.phase === 'custom') {
        main = `<div class="ws-custom"><div class="ws-pen">✍️</div><h2>Final round: the host asks!</h2><p><b>${esc(s.host || 'The host')}</b> is writing a question just for this room… ${timer(s.endsIn)}</p></div>`;
      } else if (s.phase === 'answer') {
        const pct = s.of ? Math.round((s.answered / s.of) * 100) : 0;
        main = `<div class="ws-qcard ${once('q:' + s.round) ? 'anim' : ''}"><div class="ws-qlabel">❓ Question ${s.round}</div><div class="ws-q">${esc(s.question)}</div></div>
          <div class="ws-status">📱 Answer on your phone! <b>${s.answered}</b> / ${s.of} in ${timer(s.endsIn)}</div>
          <div class="ws-progress"><span style="width:${pct}%"></span></div>
          <div class="ws-waiting">${s.waiting.length ? 'Still thinking: ' + s.waiting.slice(0, 24).map(esc).join(', ') + (s.of - s.answered > 24 ? ` +${s.of - s.answered - 24} more` : '') : 'Everyone’s in! 🎉'}</div>`;
      } else if (s.spot) {
        const sp = s.spot, r = sp.result, key = `${s.round}:${sp.n}`;
        const fresh = once('a:' + key), anim = r ? once('r:' + key) : false;
        const status = r
          ? `<div class="ws-banner ${r.bluff ? 'bluff' : ''}">${mood(r)}${r.authorPts ? ` <span class="ws-plus">+${r.authorPts}</span>` : ''}</div>
            <div class="ws-who-got">${r.first.length ? `✅ Got it: ${r.first.map(esc).join(', ')}${r.right > r.first.length ? ` +${r.right - r.first.length}` : ''}` : ''}${r.fires.length ? `<br>🔥 On fire: ${r.fires.map(esc).join(', ')}` : ''}</div>`
          : `<div class="ws-status">🗳️ Who said it? <b>${sp.voted}</b> / ${sp.of} guessed ${timer(s.endsIn)}</div>`;
        main = `<div class="ws-qsmall">${esc(s.question)}</div>
          <div class="ws-spotn">🔦 Spotlight ${sp.n} of ${sp.total}</div>
          <div class="ws-answer ${fresh ? 'anim' : ''} ${r ? 'shown' : ''}"><span class="ws-quote">“</span>${esc(sp.text)}<span class="ws-quote">”</span></div>
          ${chips(sp, anim)}<div class="ws-after ${anim ? 'anim' : ''}">${status}</div>`;
      } else if (s.phase === 'wall') {
        const notes = s.wall.map((w, i) => `<div class="ws-note" style="--r:${((i * 37) % 7) - 3}deg;--d:${Math.min(i, 30) * 0.06}s"><div class="ws-note-t">${esc(w.text)}</div><div class="ws-note-n">— ${esc(w.name)}</div></div>`).join('');
        main = `<div class="ws-qsmall">${esc(s.question)}</div>
          ${s.wall.length ? `<h2 class="ws-wall-h">📌 The rest of the wall</h2><div class="ws-wall ${once('w:' + s.round) ? 'anim' : ''}">${notes}</div>${s.wallMore ? `<p class="muted">…and ${s.wallMore} more answers</p>` : ''}`
            : `<div class="ws-custom"><div class="ws-pen">🏁</div><h2>Round ${s.round} complete!</h2><p>${s.round >= s.rounds ? 'Final results coming up…' : 'Next question coming up…'} ${timer(s.endsIn)}</p></div>`}`;
      }
      paint(el, sigOf(s), `<div class="ws-root ws-tv"><section class="ws-main">${top}${main}</section><aside class="panel ws-side"><h3>Scores</h3>${BOX.board(scoreRows(s.standings), (r) => r.points, '')}</aside></div>`);
    },

    phone(el, v, ctx) {
      if (!v) return;
      if (v.phase === 'over') {
        const st = v.stats || {};
        paint(el, sigOf(v), `<div class="ws-root"><div class="card-box ws-center"><h3>Game over!</h3><div class="ws-rank">#${v.rank}</div><p>${v.points} points</p>
          ${v.awards && v.awards.length ? `<div class="ws-myawards">${v.awards.map((a) => `<div class="ws-myaward">${a.icon} <b>${esc(a.title)}</b><small>${esc(a.value)}</small></div>`).join('')}</div>` : ''}
          <div class="ws-stats"><span>✅ ${st.correct}/${st.guesses} right</span><span>🕵️ fooled ${st.fooled}</span><span>🎭 ${st.bluffs} bluff${st.bluffs === 1 ? '' : 's'}</span><span>🔥 best streak ${st.best}</span></div></div>
          <div class="card-box">${BOX.board(v.final, (r) => r.points, '')}</div></div>`);
        return;
      }
      const head = `<div class="ws-me"><span>🏅 ${v.points} pts · #${v.rank || '-'}</span>${v.streak >= 2 ? `<span class="ws-streak">🔥 ${v.streak}</span>` : ''}<span class="muted">Round ${v.round}/${v.rounds}</span></div>`;

      if (v.phase === 'custom') {
        if (!v.isHost) { paint(el, sigOf(v), `<div class="ws-root">${head}<div class="big-status">👑 ${esc(v.host || 'The host')} is writing the final question… ✍️</div><p class="muted ws-center">${timer(v.endsIn)}</p></div>`); return; }
        if (paint(el, sigOf(v), `<div class="ws-root">${head}<div class="card-box"><h3>👑 You ask the final question! ${timer(v.endsIn)}</h3><p class="muted">Everyone will answer it, then guess who said what.</p>
          <input id="ws-q" class="ws-input" maxlength="${v.qmax}" placeholder="What’s something you’ve never told this group?" value="${esc(qdraft)}">
          <button class="btn big green ws-wide" id="ws-ask">Ask it!</button><button class="btn ghost small ws-wide" id="ws-surprise">🎲 Surprise me (random question)</button></div></div>`)) {
          const q = el.querySelector('#ws-q'); q.oninput = () => { qdraft = q.value; };
          el.querySelector('#ws-ask').onclick = async () => { const r = await ctx.act({ op: 'question', text: q.value }); if (r.ok) { qdraft = ''; ctx.sfx('chime'); } };
          el.querySelector('#ws-surprise').onclick = () => ctx.act({ op: 'surprise' });
        }
        return;
      }

      if (v.phase === 'answer') {
        const k = v.round + ':' + v.question;
        if (draftKey !== k) { draftKey = k; draft = ''; editing = false; }
        const qcard = `<div class="ws-qphone">${esc(v.question)}</div>`;
        if (v.answered && !editing) {
          if (paint(el, sigOf(v, 'done'), `<div class="ws-root">${head}${qcard}<div class="big-status">Locked in! ✅</div><div class="ws-mine">“${esc(v.myAnswer)}”</div>
            <p class="muted ws-center">Keep it secret… ${timer(v.endsIn)}</p><button class="btn ghost small ws-wide" id="ws-edit">✏️ Change my answer</button></div>`)) {
            el.querySelector('#ws-edit').onclick = () => { editing = true; draft = v.myAnswer; ctx.redraw(); };
          }
          return;
        }
        if (paint(el, sigOf(v, 'write'), `<div class="ws-root">${head}${qcard}<div class="card-box"><div class="ws-row"><b>Your answer</b>${timer(v.endsIn)}</div>
          <input id="ws-a" class="ws-input" maxlength="${v.max}" placeholder="Be honest… or be sneaky" value="${esc(draft)}" autocomplete="off">
          <div class="ws-row muted"><small>Nobody will see your name.</small><small class="ws-count">${draft.length}/${v.max}</small></div>
          <button class="btn big green ws-wide" id="ws-send">Lock it in</button></div></div>`)) {
          const a = el.querySelector('#ws-a'), cnt = el.querySelector('.ws-count');
          a.oninput = () => { draft = a.value; cnt.textContent = `${draft.length}/${v.max}`; };
          a.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el.querySelector('#ws-send').click(); } };
          el.querySelector('#ws-send').onclick = async () => {
            draft = a.value; if (!draft.trim()) return ctx.toast('Type an answer first.');
            const r = await ctx.act({ op: 'answer', text: draft });
            if (r.ok) { editing = false; ctx.sfx('pop'); ctx.vibrate(30); a.blur(); ctx.redraw(); }
          };
        }
        return;
      }

      if (v.spot) {
        const sp = v.spot, key = v.round + ':' + sp.n;
        if (ddKey !== key) { ddKey = key; ddOn = false; }
        const ans = `<div class="ws-ansphone">“${esc(sp.text)}”</div>`;
        if (v.phase === 'reveal' && sp.result) {
          const r = sp.result, g = sp.gain;
          let card;
          if (sp.mine) card = `<h3>${r.bluff ? '🎭 Bluff badge! Nobody guessed you!' : r.fooled ? `😈 You fooled ${r.fooled}!` : '📖 They know you too well!'}</h3>${r.authorPts ? `<div class="ws-gain plus">+${r.authorPts}</div>` : ''}`;
          else if (!g) card = `<h3>⏰ You didn’t guess</h3><p>It was <b>${esc(r.name)}</b></p>`;
          else card = `<h3>${g.right ? '🎯 You got it!' : '😵 Fooled!'}</h3><p>It was <b>${esc(r.name)}</b></p>
            <div class="ws-gain ${g.pts > 0 ? 'plus' : g.pts < 0 ? 'minus' : ''}">${g.pts > 0 ? '+' : ''}${g.pts}</div>
            <div class="ws-tags">${g.speed ? '<span>⚡ speed bonus</span>' : ''}${g.dd ? `<span>🎲 double down${g.right ? '' : ' (−50)'}</span>` : ''}${g.fire ? '<span>🔥 3 in a row! +50</span>' : ''}</div>`;
          if (paint(el, sigOf(v), `<div class="ws-root">${head}${ans}<div class="card-box ws-center ws-result ${once('pr:' + key) ? 'anim' : ''}">${card}</div></div>`)) {
            if (once('ps:' + key)) { const good = sp.mine ? r.fooled > 0 : g && g.right; ctx.sfx(good ? 'chime' : 'shrug'); if (good) ctx.vibrate(80); }
          }
          return;
        }
        if (sp.mine) { paint(el, sigOf(v), `<div class="ws-root">${head}${ans}<div class="card-box ws-center ws-poker"><div class="ws-pokerface">😐</div><h3>That’s yours — keep a poker face!</h3><p class="muted">${sp.voted}/${sp.of} guessed ${timer(v.endsIn)}</p></div></div>`); return; }
        if (sp.myPick != null) {
          paint(el, sigOf(v), `<div class="ws-root">${head}${ans}<div class="card-box ws-center"><h3>Locked in: ${esc(sp.names[sp.myPick])} ✅</h3>${sp.myDd ? '<p class="ws-dd-on">🎲 Doubled down!</p>' : ''}<p class="muted">${sp.voted}/${sp.of} guessed ${timer(v.endsIn)}</p></div></div>`);
          return;
        }
        if (paint(el, sigOf(v, ddOn), `<div class="ws-root">${head}${ans}<div class="ws-row"><b>Who said it?</b>${timer(v.endsIn)}</div>
          ${v.canDd ? `<button class="ws-dd ${ddOn ? 'on' : ''}" id="ws-dd">🎲 Double Down ${ddOn ? 'ON: 2× points, −50 if wrong' : '(once per game)'}</button>` : ''}
          <div class="ws-picks">${sp.names.map((n, i) => `<button class="ws-pick" data-k="${i}"><span class="ws-k">${'ABCD'[i]}</span>${esc(n)}</button>`).join('')}</div></div>`)) {
          const dd = el.querySelector('#ws-dd'); if (dd) dd.onclick = () => { ddOn = !ddOn; ctx.vibrate(15); ctx.redraw(); };
          for (const b of el.querySelectorAll('[data-k]')) b.onclick = async () => {
            for (const x of el.querySelectorAll('[data-k]')) x.disabled = true;
            b.classList.add('sel'); ctx.vibrate(25);
            const r = await ctx.act({ op: 'guess', pick: Number(b.dataset.k), dd: ddOn && v.canDd });
            if (r.ok) ctx.sfx(ddOn ? 'unlock' : 'click'); else { el.dataset.wsSig = ''; ctx.redraw(); }
          };
        }
        return;
      }

      if (v.phase === 'wall') {
        paint(el, sigOf(v), `<div class="ws-root">${head}<div class="big-status">📌 Round ${v.round} done!</div><p class="ws-center">You’re <b>#${v.rank}</b> of ${v.of}. ${v.round >= v.rounds ? 'Final results next…' : 'Next question coming…'}</p>${v.myAnswer ? `<div class="ws-mine">You said: “${esc(v.myAnswer)}”</div>` : ''}</div>`);
        return;
      }
      paint(el, sigOf(v), `<div class="ws-root">${head}<div class="big-status">👀 Watch the big screen…</div></div>`);
    },
  };
})();
