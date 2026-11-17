'use strict';
// JustBlanks screens, dressed as the title screen's cheeky game-show stage: a tangerine
// sunburst, purple prompt cards with a yellow inner border, cream answer cards with candy
// stripes, Luckiest Guy lettering and a marquee stage lip. TV: the lobby (the house rules are
// a fanned hand of cards you flip through), the prompt and who has played, each answer read
// into the prompt, the Judge / vote, the winner with a HA! sticker, the awards. Phone: your
// hand (tap to pick, in order), write-your-own, judging / voting / hearts, your result.
// Everything updates in place (BOX.morph), so taps land and animations play once.
(function () {
  const { esc, timer } = BOX;
  let picked = [], writing = false, draft = '', swapArm = 0, judgeSel = null, selRound = 0, lobbyErr = '';
  const once = new Set();
  const first = (k) => { if (once.has(k)) return false; once.add(k); if (once.size > 300) once.clear(); return true; };
  const STRIPES = ['#ff4f8b', '#3ec7ff', '#7ee06a', '#ffb627', '#b77bff'];
  const hash = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.codePointAt(0)) >>> 0; return h; };
  const stripe = (k) => STRIPES[hash(k) % STRIPES.length];
  const tilt = (k, amp = 2.4) => (((hash(k) % 100) / 100) * 2 - 1) * amp;
  // Fill the prompt's blanks with the chosen answers.
  const fill = (prompt, cards) => { let i = 0; const out = esc(prompt).replace(/___/g, () => `<u>${esc(cards[i++] || '____')}</u>`); return i < cards.length ? out + ' <u>' + cards.slice(i).map(esc).join(' / ') + '</u>' : out; };
  const blank = (t) => esc(t).replace(/___/g, '<span class="bl-gap"></span>');
  const nm = (o) => (o ? (o.av ? esc(o.av) + ' ' : '') + esc(o.name) : '');
  const pickTag = (p) => (p && p.pick > 1 ? `<span class="bl-pick">PICK ${p.pick}</span>` : '');
  const love = (a) => [a.votes ? `${a.votes} vote${a.votes === 1 ? '' : 's'}` : '', a.hearts ? `${a.hearts} ❤️` : ''].filter(Boolean).join(' · ');
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  // The purple prompt card (tab on top, footer at the bottom).
  const promptCard = (inner, o = {}) => `<div class="bl-black bx-prompt ${o.cls || ''}" ${o.id ? `id="${esc(o.id)}"` : ''}><span class="bx-tab">${o.tab || 'FILL IT IN!'}</span><div class="bx-ptext">${inner}</div>${o.pick || ''}${o.foot ? `<span class="bx-foot">${o.foot}</span>` : ''}</div>`;
  // A cream answer card with a candy stripe.
  const answerCard = (cards, o = {}) => `<div class="bl-white bx-card ${o.cls || ''}" ${o.id ? `id="${esc(o.id)}"` : ''} style="--st:${stripe(o.key || cards.join('|'))};--tl:${tilt(o.key || cards.join('|'))}deg${o.d != null ? `;--d:${o.d}s` : ''}">${o.n != null ? `<span class="bx-n">${o.n}</span>` : ''}${cards.map((c) => `<div>${esc(c)}</div>`).join('<hr>')}${o.by ? `<small>${o.by}</small>` : ''}</div>`;
  const scoreboard = (list, s) => `<aside class="bx-score"><h3>Scoreboard</h3><div class="bx-rows">${(list || []).map((r, i) => `<div class="bx-row ${i === 0 && r.points > 0 ? 'lead' : ''}"><span class="bx-rk">${i === 0 && r.points > 0 ? '👑' : i + 1}</span><span class="bx-av">${esc(r.av || '🙂')}</span><span class="bx-nm">${esc(r.name)}</span><b>${r.points}</b></div>`).join('')}</div>${s && s.toWin ? `<div class="bx-goal">First to <b>${s.toWin}</b> wins</div>` : ''}</aside>`;

  // ---------- TV lobby: the house rules as a fanned hand of cards ----------
  function lobbyTv(el, L) {
    const n = L.players.length, need = Math.max(0, L.min - n), F = L.fields || [];
    const mid = (F.length - 1) / 2, cw = Math.min(168, Math.floor(1090 / Math.max(1, F.length)) + 12), step = F.length > 6 ? 4 : 5;
    const cards = F.map((f, i) => {
      const cur = f.options.find((o) => String(o.value) === String(L.settings[f.key])) || f.options[0];
      const at = f.options.indexOf(cur), off = i - mid;
      return `<div role="button" tabindex="0" class="bx-rule" data-rule="${esc(f.key)}" style="--st:${STRIPES[i % STRIPES.length]};--r:${(off * step).toFixed(1)}deg;--y:${(Math.abs(off) * Math.abs(off) * (step + 2)).toFixed(0)}px;--i:${i};--w:${cw}px">
        <span class="bx-rl">${esc(f.label)}</span><span class="bx-rv" id="bxv-${esc(f.key)}-${esc(String(cur.value))}">${esc(cur.label)}</span>
        <span class="bx-dots">${f.options.map((o, k) => `<i class="${k === at ? 'on' : ''}"></i>`).join('')}</span><span class="bx-flip">tap to flip ↻</span>
        <select data-set="${esc(f.key)}" tabindex="-1" aria-label="${esc(f.label)}">${f.options.map((o) => `<option value="${esc(String(o.value))}" ${String(L.settings[f.key]) === String(o.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></div>`;
    }).join('');
    BOX.morph(el, `<div class="bx bx-lobby">
      <section class="bx-joincard">
        <span class="bx-tab">JOIN THE SHOW!</span>
        <div class="bx-qrwrap"><img id="qr" alt="QR code to join" src="${esc(L.qr)}"></div>
        <div class="bx-url">${esc(L.joinUrl.replace(/^https?:\/\//, ''))}</div>
        <div class="bx-codel">Room code</div><div class="bx-code" id="code">${esc(L.code)}</div>
        <div class="bx-vip">${L.vip ? `👑 <b>${esc(L.vip)}</b> is the host` : 'First to join is the host 👑'}</div>
      </section>
      <section class="bx-center">
        <div class="bx-logo"><span class="j">Just</span><span class="w">Bl<span class="slot"><i>a</i></span>nks</span></div>
        <div class="bx-house">The house rules <small>tap a card to flip it</small></div>
        <div class="bx-hand" id="settings">${cards}</div>
        <div class="bx-go"><button class="bx-start" id="start" ${need ? 'disabled' : ''}>🃏 Deal me in!</button>
          <div class="bx-err" id="lobby-err">${esc(lobbyErr)}</div>
          <div class="bx-need">${need ? `Need ${need} more player${need === 1 ? '' : 's'} to start` : `${plural(n, 'player')} ready · the host can start from their phone too`}</div>
          <div class="bx-links"><button class="bx-link" id="add-bots">+ add 5 test bots</button><button class="bx-link" id="rm-bots">remove bots</button><button class="bx-link" id="tv-switch">🎮 other game</button></div></div>
      </section>
      <section class="bx-cast"><div class="bx-casth">Tonight’s players <b>${n}</b>/${L.max || 100}</div>
        <div class="bx-roster" id="roster">${L.players.map((p, i) => `<span class="chip bx-chip ${p.online ? '' : 'off'}" id="bxc-${esc(p.id)}" data-kick="${esc(p.id)}" title="Click to remove" style="--st:${STRIPES[i % STRIPES.length]};--tl:${tilt(p.id, 5)}deg"><span class="bx-cav">${esc(p.avatar || '🙂')}</span><span class="bx-cnm">${esc(p.name)}</span>${p.bot ? '<small>bot</small>' : ''}</span>`).join('') || '<div class="bx-empty">Scan the code and grab a seat!<br>Your phone is your hand of cards.</div>'}</div>
        ${L.lineupHtml ? `<div class="bx-lineup">${L.lineupHtml}</div>` : ''}
      </section>
    </div><div class="bx-lip"></div>`);
    for (const s of el.querySelectorAll('select[data-set]')) { s.onchange = () => L.set(s.dataset.set, s.value); s.onclick = (e) => e.stopPropagation(); }
    for (const b of el.querySelectorAll('[data-rule]')) b.onclick = () => {
      const s = b.querySelector('select'), k = s.selectedIndex;
      s.selectedIndex = (k + 1) % s.options.length; BOX.sfx('flip'); s.onchange();
    };
    el.querySelector('#start').onclick = async () => { const r = await L.start(); lobbyErr = r && !r.ok ? r.error || 'Could not start.' : ''; const e = el.querySelector('#lobby-err'); if (e) e.textContent = lobbyErr; };
    el.querySelector('#add-bots').onclick = () => L.bots(5);
    el.querySelector('#rm-bots').onclick = () => L.removeBots();
    el.querySelector('#tv-switch').onclick = () => L.pick();
    for (const c of el.querySelectorAll('[data-kick]')) c.onclick = () => { if (confirm('Remove this player?')) L.kick(c.dataset.kick); };
  }

  // ---------- TV: game over ----------
  function tvOver(el, s) {
    const w = s.standings[0], b = s.best;
    const awards = (s.awards || []).map((x, i) => `<div class="bx-award" style="--d:${0.9 + i * 0.25}s;--st:${STRIPES[i % STRIPES.length]};--tl:${tilt(x.title, 3)}deg"><div class="ic">${x.icon}</div><div class="t">${esc(x.title)}</div><div class="n">${nm(x)}</div><div class="v">${esc(x.value)}</div></div>`).join('');
    BOX.morph(el, `<div class="bx bx-tv bx-over" data-phase="over">
      <section class="bx-overmain">
        <div class="bx-champ"><div class="bx-burst"></div><div class="bx-champl">Funniest person in the room</div><h2>${nm(w)}</h2>${w ? `<div class="bx-pts">${plural(w.points, 'point')}</div>` : ''}</div>
        ${b ? `<div class="bx-best"><div class="bx-label">🏆 Line of the night</div>${promptCard(fill(b.prompt, b.cards), { cls: 'mid', tab: 'BEST LINE', foot: `${nm(b)}${b.love ? ` · ${b.love} ❤️` : ''}` })}</div>` : ''}
        ${awards ? `<div class="bx-awards">${awards}</div>` : ''}
      </section>${scoreboard(s.standings.slice(0, 10))}</div><div class="bx-lip"></div>`);
  }

  function tvMain(s) {
    const top = `<header class="bx-top"><span class="bx-tix">Round <b>${s.round}</b> of ${s.rounds}</span><span class="bx-tix pink">First to <b>${s.toWin}</b></span>${s.judge ? `<span class="bx-tix gold">⚖️ Judge: <b>${nm(s.judge)}</b></span>` : '<span class="bx-tix gold">🗳️ Everyone votes</span>'}${s.endsIn && s.phase !== 'win' && s.phase !== 'reveal' ? `<span class="bx-clock">⏱ ${timer(s.endsIn)}</span>` : ''}</header>`;
    const P = s.prompt;
    if (s.phase === 'pick') {
      const left = s.of - s.played;
      return `${top}<div class="bx-stage"><div class="bx-pickrow">${P ? promptCard(blank(P.text), { cls: 'big drop', id: `bxp-${s.round}`, pick: pickTag(P), foot: `JUSTBLANKS · ROUND ${s.round}` }) : ''}
        <div class="bx-table"><div class="bx-call">📱 Play your funniest card!</div><div class="bx-count"><b>${s.played}</b> of ${s.of} played</div>
        ${s.hurry ? `<div class="bx-hurry">⏰ Hurry up! Waiting on ${left} more…</div>` : ''}
        <div class="bx-seats">${s.table.map((p) => `<div class="bx-seat ${p.done ? 'done' : ''}" id="bxt-${esc(p.name)}-${p.done ? 1 : 0}"><div class="bx-sc">${p.done ? '<b>J!</b>' : `<i>${esc(p.av || '🙂')}</i>`}</div><span>${esc(p.name)}</span></div>`).join('')}${s.tableMore ? `<div class="bx-seat more"><div class="bx-sc"><i>+${s.tableMore}</i></div></div>` : ''}</div></div></div></div>`;
    }
    if (s.phase === 'reveal') {
      const cur = s.answers[s.answers.length - 1], earlier = s.answers.slice(0, -1);
      return `${top}<div class="bx-stage"><div class="bx-readwrap">${cur ? promptCard(fill(P.text, cur.cards), { cls: 'huge read', id: `bxr-${cur.sid}`, tab: `ANSWER ${s.answers.length} OF ${s.total}` }) : promptCard(blank(P.text), { cls: 'huge' })}
        <div class="bx-minis">${earlier.map((a, i) => answerCard(a.cards, { cls: 'mini pop', id: 'bw-' + a.sid, key: a.sid })).join('')}</div></div></div>`;
    }
    if (s.phase === 'choose') {
      const status = s.judge
        ? `<span class="bx-gavel">⚖️</span> <b>${nm(s.judge)}</b> is choosing the funniest…<small>Everyone else: send a ❤️ to your favourite! (${s.voted} sent)</small>`
        : `🗳️ Vote on your phone! <b>${s.voted}</b> / ${s.voters} voted${s.notVoted.length && s.voted ? `<small>Waiting on: ${s.notVoted.map(esc).join(', ')}</small>` : ''}`;
      const n = s.answers.length;
      return `${top}<div class="bx-stage"><div class="bx-chooserow">${promptCard(blank(P.text), { cls: 'mid', pick: pickTag(P) })}<div class="bx-callout">${status}</div></div>
        <div class="bx-grid n${Math.min(n, 9)} ${n > 8 ? 'dense' : ''} ${n > 15 ? 'xdense' : ''}">${s.answers.map((a, i) => answerCard(a.cards, { cls: 'num deal', id: 'bw-' + a.sid, key: a.sid, n: i + 1, d: Math.min(i, 20) * 0.05 })).join('')}</div></div>`;
    }
    if (s.phase === 'win' && s.last) {
      const L = s.last;
      if (L.none) return `${top}<div class="bx-stage"><div class="bx-readwrap">${promptCard(blank(P.text), { cls: 'huge' })}<div class="bx-callout">😶 Nobody played a card. Next round!</div></div></div>`;
      const how = L.how === 'judge' ? `⚖️ ${esc(L.judge || 'The Judge')} picked it` : L.how === 'tie' ? '🤝 A tie! Both get a point' : L.how === 'random' ? '⏰ Time ran out: picked at random' : `🗳️ ${plural(L.winners[0].votes, 'vote')}`;
      const wins = L.winners.map((w, i) => `<div class="bx-winwrap" style="--d:${i * 0.4}s">${promptCard(fill(P.text, w.cards), { cls: 'huge winner', tab: 'WINNER!' })}<div class="bx-ha">HA!</div></div><div class="bx-stamprow"><div class="bl-by bx-stamp" style="--d:${1.4 + i * 0.4}s">🏆 ${nm(w)}${w.written ? ' <small>✍️ wrote it!</small>' : ''}</div></div>`).join('');
      const others = L.all.filter((a) => !a.win);
      return `${top}<div class="bx-stage"><div class="bl-win bx-win" id="blw-${s.round}"><div class="bx-burst"></div>${wins}<div class="bx-how">${how}</div>
        ${L.crowd ? `<div class="bx-crowd">❤️ Crowd favourite: <b>${nm(L.crowd)}</b> with “${L.crowd.cards.map(esc).join(' / ')}” (${L.crowd.hearts} ❤️)</div>` : ''}
        ${others.length ? `<div class="bx-who">${others.slice(0, 8).map((a) => answerCard(a.cards, { cls: 'mini', key: a.sid || a.name, by: `${nm(a)}${love(a) ? ' · ' + love(a) : ''}` })).join('')}${L.more || others.length > 8 ? `<div class="bx-more">+${(L.more || 0) + Math.max(0, others.length - 8)} more</div>` : ''}</div>` : ''}</div></div>`;
    }
    return `${top}${P ? promptCard(blank(P.text), { cls: 'big' }) : ''}`;
  }

  // ---------- phone ----------
  function phoneOver(el, v, ctx) {
    const b = v.myBest;
    BOX.morph(el, `<div class="bx bx-ph" data-phase="over"><div class="bx-pcard bx-center bx-overph"><div class="bx-rank"><span>#${v.rank}</span></div><h3>${v.rank === 1 ? 'Funniest in the room!' : 'Game over!'}</h3><p class="bx-big">${plural(v.points, 'point')}</p>
      ${v.stats ? `<div class="bx-stats"><span>🏆 ${plural(v.stats.wins, 'round')} won</span><span>❤️ ${v.stats.love} votes &amp; hearts</span>${v.stats.written ? `<span>✍️ ${v.stats.written} written win${v.stats.written === 1 ? '' : 's'}</span>` : ''}</div>` : ''}
      ${(v.awards || []).map((a) => `<div class="bx-myaward">${a.icon} <b>${esc(a.title)}</b><small>${esc(a.value)}</small></div>`).join('')}</div>
      ${b ? `<div class="bx-label">Your best line</div>${promptCard(fill(b.prompt, b.cards), { cls: 'small', tab: 'YOUR BEST' })}` : ''}
      <div class="bx-pcard">${(v.final || []).map((r, i) => `<div class="bx-row ${i === 0 ? 'lead' : ''}"><span class="bx-rk">${i === 0 ? '👑' : i + 1}</span><span class="bx-av">${esc(r.av || '🙂')}</span><span class="bx-nm">${esc(r.name)}</span><b>${r.points}</b></div>`).join('')}</div></div>`);
    if (first('over:' + v.rank + ':' + v.points)) ctx.haptic(v.rank === 1 ? 'win' : 'big');
  }

  function phone(el, v, ctx) {
    if (!v) return;
    if (v.phase === 'over') return phoneOver(el, v, ctx);
    if (selRound !== v.round) { selRound = v.round; judgeSel = null; swapArm = 0; }
    const rk = `${v.round}:${v.prompt ? v.prompt.text : ''}`;
    const head = `<div class="bx-me"><span class="bx-pts">🏅 ${v.points} pt${v.points === 1 ? '' : 's'} <small>#${v.rank || '-'}</small></span><span class="bx-rnd">Round ${v.round}/${v.rounds} · first to ${v.toWin}</span></div>
      ${v.prompt ? promptCard(blank(v.prompt.text), { cls: 'small', pick: pickTag(v.prompt) }) : ''}`;
    const prog = v.progress ? `<div class="bx-prog"><span style="width:${v.progress.of ? Math.round((v.progress.done / v.progress.of) * 100) : 0}%"></span></div><p class="bx-muted bx-center">${v.progress.done} / ${v.progress.of} played ${timer(v.endsIn)}</p>` : '';
    const bare = head.split('</div>')[0] + '</div>';
    const wrap = (phase, html, noPrompt) => `<div class="bx bx-ph" data-phase="${phase}">${noPrompt ? bare : head}${html}</div>`;

    if (v.phase === 'pick') {
      if (first('turn:' + rk)) ctx.haptic('turn');
      if (v.hurry && !v.played && !v.isJudge && first('hurry:' + rk)) ctx.haptic('warn');
      if (v.isJudge) { BOX.morph(el, wrap('judge', `<div class="bx-pcard bx-center bx-judgecard"><div class="bx-emoji">⚖️</div><h3>You’re the Judge!</h3><p>Sit back. When the answers are in, you crown the funniest.</p>${prog}</div>`)); return; }
      if (v.played) {
        picked = []; writing = false;
        BOX.morph(el, wrap('played', `<div class="bx-played"><div class="bx-back"><b>J!</b></div>${answerCard(v.mine, { cls: 'mine', key: 'mine' })}</div><div class="bx-bigmsg">Card played!</div>${prog}`));
        return;
      }
      const need = v.prompt.pick;
      picked = picked.filter((p) => p.w || v.hand.some((c) => c.id === p.id));
      const pos = (c) => picked.findIndex((p) => p.id === c.id);
      const ready = picked.length === need;
      BOX.morph(el, wrap('pick', `<div class="bl-pickinfo bx-hint">${v.hurry ? '⏰ <b>Hurry!</b> ' : ''}Tap ${need > 1 ? need + ' cards in order' : 'your funniest card'} ${timer(v.endsIn)}</div>
        <div class="bl-hand bx-hand2">${v.hand.map((c) => { const k = pos(c); return `<button class="bl-card ${k >= 0 ? 'sel' : ''}" data-c="${esc(c.id)}" style="--st:${stripe(c.id)}">${k >= 0 ? `<span class="n">${need > 1 ? k + 1 : '✓'}</span>` : ''}${esc(c.text)}</button>`; }).join('')}
        ${picked.filter((p) => p.w).map((p) => `<button class="bl-card sel written" data-w="${esc(p.id)}" style="--st:#ffe14d"><span class="n">${need > 1 ? picked.indexOf(p) + 1 : '✍️'}</span>${esc(p.text)}</button>`).join('')}
        ${!writing && v.blanks > 0 ? `<button class="bl-card bx-blankcard" id="bl-blank"><span class="bx-pen">✍️</span>Write your own<small>${v.blanks >= 99 ? 'unlimited' : v.blanks + ' left'}</small></button>` : ''}</div>
        ${writing ? `<div class="bx-pcard bx-writebox"><label>Your own answer card</label><input id="bl-write" class="bx-input" maxlength="70" value="${esc(draft)}" placeholder="something hilarious" autocomplete="off"><div class="bx-btns"><button class="bx-btn ghost" id="bl-wcancel">Cancel</button><button class="bx-btn" id="bl-wadd">Add card</button></div></div>` : ''}
        ${v.canSwap && !writing ? `<div class="bx-btns"><button class="bx-btn ghost ${swapArm > Date.now() ? 'arm' : ''}" id="bl-swap">${swapArm > Date.now() ? 'Tap again to swap all 7' : '🔄 New hand (once a game)'}</button></div>` : ''}
        <div class="bx-sticky"><button class="bx-play ${ready ? 'ready' : ''}" id="bl-play" ${ready ? '' : 'disabled'}>${ready ? 'Play it!' : 'Play'} ${picked.length}/${need}</button></div>`));
      for (const b of el.querySelectorAll('[data-c]')) b.onclick = () => { const id = b.dataset.c, k = picked.findIndex((p) => p.id === id); if (k >= 0) picked.splice(k, 1); else { if (picked.length >= need) picked.shift(); picked.push({ id }); } ctx.haptic('select'); ctx.redraw(); };
      for (const b of el.querySelectorAll('[data-w]')) b.onclick = () => { picked = picked.filter((p) => p.id !== b.dataset.w); ctx.redraw(); };
      const bb = el.querySelector('#bl-blank'); if (bb) bb.onclick = () => { writing = true; ctx.redraw(); setTimeout(() => { const i = el.querySelector('#bl-write'); if (i) i.focus(); }, 50); };
      const sw = el.querySelector('#bl-swap'); if (sw) sw.onclick = () => {
        if (swapArm > Date.now()) { swapArm = 0; picked = []; ctx.act({ op: 'swap' }).then((r) => { if (r.ok) { ctx.sfx('shuffle'); ctx.haptic('success'); } }); }
        else { swapArm = Date.now() + 3000; ctx.haptic('warn'); setTimeout(() => ctx.redraw(), 3100); }
        ctx.redraw();
      };
      const wi = el.querySelector('#bl-write');
      const addW = () => { const t = ((wi && wi.value) || '').replace(/\s+/g, ' ').trim().slice(0, 70); if (!t) return ctx.toast('Type something first.'); if (picked.length >= need) picked.shift(); picked.push({ id: 'w' + Date.now(), w: true, text: t }); writing = false; draft = ''; if (wi) wi.blur(); ctx.haptic('select'); ctx.redraw(); };
      if (wi) { wi.oninput = () => { draft = wi.value; }; wi.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); addW(); } }; }
      const wc = el.querySelector('#bl-wcancel'); if (wc) wc.onclick = () => { writing = false; draft = ''; if (wi) wi.blur(); ctx.redraw(); };
      const wa = el.querySelector('#bl-wadd'); if (wa) wa.onclick = addW;
      el.querySelector('#bl-play').onclick = async () => {
        if (picked.length !== need) return;
        const r = await ctx.act({ op: 'play', cards: picked.filter((p) => !p.w).map((p) => p.id), written: picked.filter((p) => p.w).map((p) => p.text), order: picked.map((p) => (p.w ? 'w' : 'c')) });
        if (r.ok) { picked = []; ctx.sfx('deal'); ctx.haptic('success'); }
      };
      return;
    }
    if (v.phase === 'reveal') { BOX.morph(el, wrap('reveal', `<div class="bx-pcard bx-center bx-curtain"><div class="bx-emoji">🎤</div><h3>Eyes on the big screen!</h3><p class="bx-muted">The answers are being read out…</p></div>`, true)); return; }
    if (v.phase === 'choose') {
      const judge = v.isJudge, voting = v.mode === 'vote';
      if (first('choose:' + rk)) ctx.haptic(judge ? 'turn' : 'tap');
      if (judge) {
        const sel = v.answers.find((a) => a.sid === judgeSel);
        BOX.morph(el, wrap('judging', `<div class="bl-pickinfo bx-hint">⚖️ Tap the funniest, then crown it ${timer(v.endsIn)}</div>
          <div class="bl-answers">${v.answers.map((a) => `<button class="bl-ans ${judgeSel === a.sid ? 'sel' : ''}" data-s="${esc(a.sid)}" style="--st:${stripe(a.sid)}">${a.cards.map(esc).join('<br>— ')}${judgeSel === a.sid ? '<span class="bx-crownmk">👑</span>' : ''}</button>`).join('')}</div>
          <div class="bx-sticky"><button class="bx-play ${sel ? 'ready' : ''}" id="bl-crown" ${sel ? '' : 'disabled'}>👑 Crown the winner</button></div>`));
        for (const b of el.querySelectorAll('[data-s]')) b.onclick = () => { judgeSel = b.dataset.s; ctx.haptic('select'); ctx.redraw(); };
        el.querySelector('#bl-crown').onclick = () => { if (judgeSel) { ctx.act({ op: 'pick', sid: judgeSel }); ctx.haptic('big'); } };
        return;
      }
      const mineSel = voting ? v.myVote : v.myHeart;
      const info = voting ? (v.myVote ? 'Vote cast ✅ (tap another to change)' : '🗳️ Vote for the funniest (not your own)') : (v.myHeart ? '❤️ Sent! (tap another to change)' : `⚖️ ${esc(v.judge)} is choosing. Send a ❤️ to your favourite!`);
      BOX.morph(el, wrap(voting ? 'vote' : 'heart', `<div class="bl-pickinfo bx-hint">${info} ${timer(v.endsIn)}</div>
        <div class="bl-answers">${v.answers.map((a) => `<button class="bl-ans ${mineSel === a.sid ? 'sel' : ''} ${a.mine ? 'mine' : ''}" data-s="${esc(a.sid)}" style="--st:${stripe(a.sid)}" ${a.mine ? 'disabled' : ''}>${mineSel === a.sid ? `<span class="bx-heart">${voting ? '✅' : '❤️'}</span>` : ''}${a.cards.map(esc).join('<br>— ')}${a.mine ? '<small>your card</small>' : ''}</button>`).join('')}</div>`));
      for (const b of el.querySelectorAll('[data-s]')) b.onclick = () => { ctx.act({ op: voting ? 'vote' : 'heart', sid: b.dataset.s }); ctx.sfx(voting ? 'ballot' : 'pop'); ctx.haptic('select'); };
      return;
    }
    if (v.phase === 'win' && v.last && !v.last.none) {
      const r = v.myResult, won = !!(r && r.win);
      const got = r && !won ? (r.votes || r.hearts ? `Your card got ${love(r)}.` : 'Your card got no love this time.') : '';
      BOX.morph(el, wrap('win', won ? `<div class="bx-pcard bx-center bx-won"><div class="bx-burst sm"></div><div class="bx-hawin">HA!</div><h3>Your card won! +1</h3></div>${v.last.winners.map((w) => promptCard(fill(v.prompt.text, w.cards), { cls: 'small', tab: 'YOUR WINNING LINE' })).join('')}`
        : `<div class="bx-bigmsg sm">🏆 ${v.last.winners.map((w) => nm(w)).join(' &amp; ')} won!</div>${v.last.winners.map((w) => promptCard(fill(v.prompt.text, w.cards), { cls: 'small', tab: 'WINNER' })).join('')}${got ? `<p class="bx-note">${got}</p>` : ''}`, true));
      if (first('won:' + rk)) { if (won) { ctx.sfx('win'); ctx.haptic('win'); } else if (r && (r.votes || r.hearts)) ctx.haptic('success'); }
      return;
    }
    BOX.morph(el, wrap('wait', '<div class="bx-bigmsg">Next round coming…</div>'));
  }

  BOX.games.blanks = {
    name: 'JustBlanks', icon: '🃏',
    about: 'Fill in the blank with the funniest card in your hand (or write your own). Anonymous answers, one winner a round.',
    how: [
      'A prompt card with a blank goes up on the big screen.',
      'Everyone plays the answer card from their phone that fills the blank best. Some prompts need two.',
      'Blank cards let you type your own answer. Once a game you can swap your whole hand.',
      'Answers are read out with no names. The Judge picks the funniest (or everybody votes, in big groups). Not judging? Send a ❤️.',
      'The winning card gets a point. First to the target wins, with awards at the end!',
    ],
    fx: { deal: 'shuffle', card: 'deal', flip: 'flip', gavel: 'gavel', hurry: 'heartbeat', reveal: 'drum', win: 'win' },
    onFx(f) { if (f.kind === 'reveal') setTimeout(() => BOX.sfx(f.how === 'random' ? 'shrug' : 'cheer'), 1500); },
    lobbyTv,
    // Phone lobby: a face-down hand waiting to be dealt.
    lobby: () => '<div class="bx bx-phlobby"><div class="bx-fan">' + [0, 1, 2, 3, 4].map((i) => '<span class="bx-back" style="--i:' + i + '"><b>J!</b></span>').join('') + '</div><p>Your hand of 7 cards is being shuffled…</p></div>',
    tv(el, s) {
      if (!s) return;
      if (s.phase === 'over') return tvOver(el, s);
      BOX.morph(el, `<div class="bx bx-tv" data-phase="${esc(s.phase)}"><section class="bx-main">${tvMain(s)}</section>${scoreboard(s.standings, s)}</div><div class="bx-lip"></div>`);
    },
    phone,
  };
})();
