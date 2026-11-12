// The afterlife on the phone: ghost predictions, a Chill, whispers to a Medium, a Mafia
// ghost's shroud and gold bets; the Medium's spirit line; the Chill a living player feels.
(function () {
  const drafts = { kind: 'winner', pick: 'town', stake: 25, chill: '' };
  let seenChill = null;
  try { seenChill = sessionStorage.getItem('mt-chill'); } catch {}
  window.MT_AFTERLIFE_UI = function (v, socket, body, { esc, reply }) {
    if (!v || v.isJudge || !v.you || v.you.spectator || v.phase === 'lobby') return;
    const emit = (data) => socket.emit('player:ghost', data, reply);
    const alive = (v.players || []).filter((p) => p.alive);
    const card = (cls, html) => { const el = document.createElement('section'); el.className = 'card afterlife ' + cls; el.innerHTML = html; body.appendChild(el); return el; };

    // A living player who was sent a Chill: a shiver on the phone (once per Chill).
    if (v.chill && String(v.chill.id) !== seenChill) {
      seenChill = String(v.chill.id); try { sessionStorage.setItem('mt-chill', seenChill); } catch {}
      if (navigator.vibrate) navigator.vibrate([60, 80, 60, 80, 160]);
      const t = document.createElement('div'); t.className = 'chill-toast'; t.setAttribute('role', 'status');
      t.innerHTML = '❄️ A chill runs down your spine…<small>A ghost is watching you.</small>';
      document.body.appendChild(t); setTimeout(() => t.classList.add('out'), 4800); setTimeout(() => t.remove(), 5600);
    }

    // The Medium's spirit line: choose which ghosts may talk to you.
    const sc = v.spiritCircle;
    if (sc) {
      const el = card('spirit-line', `<h3>🕯 Spirit line <small>${sc.invited.length}/${sc.max}</small></h3>
        <p class="small muted">Only the ghosts you call on can reach you: one word each, every day and every night.</p>
        ${sc.ghosts.length ? `<div class="spirit-ghosts">${sc.ghosts.map((g) => { const on = sc.invited.includes(g.id); return `<button class="btn small ${on ? '' : 'ghost'}" data-spirit="${esc(g.id)}" data-on="${on ? 0 : 1}">${on ? '🔗 ' : '👻 '}${esc(g.name)}${on ? ' · release' : ' · call'}</button>`; }).join('')}</div>` : '<p class="small muted">No spirits yet. Nobody has died.</p>'}
        ${sc.log.length ? `<ul class="whispers">${sc.log.map((w) => `<li><b>${esc(w.name)}</b> whispers <q>${esc(w.word)}</q> <small>${w.night ? 'night' : 'day'} ${w.day}</small></li>`).join('')}</ul>` : ''}`);
      el.querySelectorAll('[data-spirit]').forEach((b) => { b.onclick = () => emit({ op: 'spirit', targetId: b.dataset.spirit, on: b.dataset.on === '1' }); });
    }

    const a = v.afterlife;
    if (!a) return;
    const over = v.phase === 'gameover';
    const opts = (sel, withNobody) => `<option value="">Choose…</option>${withNobody ? `<option value="none"${sel === 'none' ? ' selected' : ''}>Nobody</option>` : ''}${alive.map((p) => `<option value="${esc(p.id)}"${sel === p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}`;

    if (!over) {
      // Predictions: a quiet game for the dead.
      const o = a.oracle;
      const el = card('oracle', `<h3>🔮 Ghost predictions <small>${o.correct}/${o.total} right</small></h3>
        ${o.voteOpen ? `<label>Voted out today<select data-predict="vote">${opts(o.vote, true)}</select></label>` : ''}
        ${o.nightOpen ? `<label>Dies tonight<select data-predict="night">${opts(o.night, true)}</select></label>` : ''}
        ${o.log.length ? `<ul class="oracle-log">${o.log.map((l) => `<li class="${l.ok ? 'ok' : ''}">${esc(l.text)}</li>`).join('')}</ul>` : '<p class="small muted">Right guesses earn gold and maybe the Ghost Oracle award.</p>'}`);
      el.querySelectorAll('[data-predict]').forEach((s) => { s.onchange = () => s.value && emit({ op: 'predict', kind: s.dataset.predict, targetId: s.value }); });

      // Haunting: a Chill, a whisper to the Medium, and (for the Mafia) the shroud.
      const sp = a.spirit, ch = a.chill, sh = a.shroud;
      const el2 = card('haunting', `<h3>👻 From beyond</h3>
        ${ch ? (ch.used ? '<p class="small">❄️ Chill sent. They felt it.</p>' : `<label>❄️ Send a Chill to<select data-chill>${opts(drafts.chill, false)}</select></label><button class="btn small" data-chill-go>❄️ Send the Chill</button><p class="small muted">Once per game: their house flickers on the TV and their phone shivers.</p>`) : ''}
        ${sp ? `<p class="small">🕯 <b>${esc(sp.mediumName)}</b>, the Medium, is listening. ${sp.sent ? 'Your word has been heard. Wait for the next ' + (v.phase === 'night' ? 'day.' : 'night.') : 'Whisper one word:'}</p>
          ${sp.sent ? '' : `<div class="words">${a.words.map((w) => `<button class="chip" data-word="${esc(w)}">${esc(w)}</button>`).join('')}</div>`}`
          : '<p class="small muted">🕯 Only a Medium can hear the dead, and no Medium has called on you.</p>'}
        ${sh ? (sh.used ? '<p class="small">🌫 You shrouded a ballot this game.</p>' : sh.open ? '<button class="btn small ghost" data-shroud>🌫 Shroud today’s ballot (once)</button><p class="small muted">Mafia ghosts only: today’s vote reveal won’t show who voted for whom.</p>' : '') : ''}`);
      const cs = el2.querySelector('[data-chill]'); if (cs) cs.onchange = () => { drafts.chill = cs.value; };
      const cg = el2.querySelector('[data-chill-go]'); if (cg) cg.onclick = () => drafts.chill && emit({ op: 'chill', targetId: drafts.chill });
      el2.querySelectorAll('[data-word]').forEach((b) => { b.onclick = () => emit({ op: 'whisper', word: b.dataset.word }); });
      const sb = el2.querySelector('[data-shroud]'); if (sb) sb.onclick = () => emit({ op: 'shroud' });
    }

    // Bets between ghosts, with real gold.
    const mine = a.wagers.filter((w) => w.mine || w.took);
    if (over && !mine.length) return;
    const status = (w) => w.status === 'settled' ? `🏆 ${esc(w.winnerName)} won ${w.stake * 2}` : w.status === 'refunded' ? '↩ refunded' : w.status === 'taken' ? `🤝 ${esc(w.fromName)} vs ${esc(w.takerName)}` : '';
    const list = (over ? mine : a.wagers).map((w) => `<li><span>${esc(w.fromName)}: <b>${esc(w.text)}</b> · ${w.stake}g</span>
      ${w.status === 'open' && !over ? (w.mine ? `<button class="btn small ghost" data-cancel="${w.id}">Cancel</button>` : w.canTake && a.betting ? `<button class="btn small" data-take="${w.id}">Take · ${w.stake}g</button>` : '<small>open</small>') : `<small>${status(w)}</small>`}</li>`).join('');
    if (drafts.kind === 'vote' && !a.canVoteBet) drafts.kind = 'winner';
    const picks = drafts.kind === 'winner' ? [['town', 'the Town wins'], ['mafia', 'the Mafia wins']] : alive.map((p) => [p.id, `${p.name} is voted out today`]);
    if (!picks.some(([k]) => k === drafts.pick)) drafts.pick = picks[0] ? picks[0][0] : '';
    const el3 = card('bets', `<h3>🎲 Ghost bets <small>${a.betting ? `💰 ${a.gold}` : ''}</small></h3>
      ${list ? `<ul class="wagers">${list}</ul>` : '<p class="small muted">No bets yet. Make one, and another ghost can take the other side.</p>'}
      ${over ? '' : !a.betting ? '<p class="small muted">Betting needs a saved character with a gold pouch.</p>' : `<details class="bet-form"${drafts.open ? ' open' : ''}><summary>Make a bet</summary>
        <label>I bet that<select data-bet-kind><option value="winner"${drafts.kind === 'winner' ? ' selected' : ''}>…who wins the game</option>${a.canVoteBet ? `<option value="vote"${drafts.kind === 'vote' ? ' selected' : ''}>…who is voted out today</option>` : ''}</select></label>
        <select data-bet-pick>${picks.map(([k, t]) => `<option value="${esc(k)}"${k === drafts.pick ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
        <div class="stakes">${a.stakes.map((s) => `<button class="chip${s === drafts.stake ? ' sel' : ''}" data-stake="${s}" ${s > a.gold ? 'disabled' : ''}>${s}g</button>`).join('')}</div>
        <button class="btn small" data-bet-go>Offer the bet</button>
        <p class="small muted">Your gold is held until it settles. Winner takes both stakes; if nobody takes it, you get it back.</p></details>`}`);
    const d = el3.querySelector('details'); if (d) d.addEventListener('toggle', () => { drafts.open = d.open; });
    const pk = el3.querySelector('[data-bet-pick]');
    const k = el3.querySelector('[data-bet-kind]'); if (k) k.onchange = () => {
      drafts.kind = k.value;
      const list = drafts.kind === 'winner' ? [['town', 'the Town wins'], ['mafia', 'the Mafia wins']] : alive.map((p) => [p.id, `${p.name} is voted out today`]);
      drafts.pick = list[0] ? list[0][0] : '';
      pk.innerHTML = list.map(([key, t]) => `<option value="${esc(key)}">${esc(t)}</option>`).join('');
    }; if (pk) pk.onchange = () => { drafts.pick = pk.value; };
    el3.querySelectorAll('[data-stake]').forEach((b) => { b.onclick = () => { drafts.stake = Number(b.dataset.stake); el3.querySelectorAll('[data-stake]').forEach((x) => x.classList.toggle('sel', x === b)); }; });
    const go = el3.querySelector('[data-bet-go]'); if (go) go.onclick = () => emit({ op: 'bet', kind: drafts.kind, pick: (pk && pk.value) || drafts.pick, stake: drafts.stake });
    el3.querySelectorAll('[data-take]').forEach((b) => { b.onclick = () => emit({ op: 'take', id: Number(b.dataset.take) }); });
    el3.querySelectorAll('[data-cancel]').forEach((b) => { b.onclick = () => emit({ op: 'cancel', id: Number(b.dataset.cancel) }); });
  };
})();
