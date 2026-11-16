'use strict';
// Most Likely To… screens. TV: the prompt card, a "votes in" counter, a drumroll, then bars that
// count up and a crowned winner with their new TITLE; at the end the Hall of Titles and awards.
// Phone: a searchable, scrollable grid of names (vote, then predict), YES/NO for the Hot Seat.
(function () {
  const { esc, mmss } = BOX;
  // Phone-side state that must survive the shell re-rendering (~6×/s).
  let q = '', scroll = 0, duo = [], duoKey = '', edit = null, celebrated = '';
  // A countdown whose end time stays fixed for one phase, so identical renders can be skipped.
  const ends = {};
  const timer = (key, endsIn) => { if (!endsIn) return ''; if (!ends[key]) ends[key] = Date.now() + endsIn; return `<span class="timer" data-ends="${ends[key]}">${mmss(ends[key] - Date.now())}</span>`; };
  const dot = (c) => `<i class="ml-dot" style="background:${esc(c || '#888')}"></i>`;
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const lead = (s) => (s.kind === 'pair' ? 'Which <b>two</b> are most likely to…' : s.kind === 'hot' ? `Would ${dot(s.seat && s.seat.color)}<b>${esc(s.seat ? s.seat.name : '?')}</b> actually…` : 'Who’s most likely to…');
  const badge = (s) => (s.kind === 'pair' ? '<div class="ml-badge pair">👯 DOUBLE TROUBLE</div>' : s.kind === 'hot' ? '<div class="ml-badge hot">🔥 HOT SEAT</div>' : '');
  const promptCard = (s, cls = '') => `<div class="ml-card ${s.kind} ${cls}">${badge(s)}<div class="ml-lead">${lead(s)}</div><div class="ml-text">${esc(s.text)}?</div></div>`;
  const names = (list) => list.map((w) => `${dot(w.color)}${esc(w.name)}`).join(' <span class="muted">&amp;</span> ');
  // Swap the HTML only when it changed (keeps animations from restarting on every sync).
  function paint(el, html, after) {
    const root = el.firstElementChild;
    if (root && root.classList.contains('ml-root') && el._mlHtml === html) return false;
    el._mlHtml = html; el.innerHTML = `<div class="ml-root">${html}</div>`;
    if (after) after(); return true;
  }
  // Numbers that count up from 0 (each waits for its row's animation delay).
  function countUp(el) {
    for (const n of el.querySelectorAll('[data-count]')) {
      const to = Number(n.dataset.count), wait = Number(n.dataset.delay || 0), dur = 900; n.textContent = '0';
      setTimeout(() => { const t0 = performance.now(); const f = (t) => { const k = Math.min(1, (t - t0) / dur); n.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); }, wait);
    }
  }
  const AWARDS = [
    ['reader', '📖', 'Room Reader', (a) => `matched the room ${plural(a.value, 'time')}`],
    ['teller', '🔮', 'Fortune Teller', (a) => `${plural(a.value, 'correct prediction')}`],
    ['main', '🌟', 'Main Character', (a) => `${plural(a.value, 'title')}`],
    ['mystery', '🕵️', 'The Mysteries', (a) => `Nobody could pin them down… yet${a.more ? ` (+${a.more} more)` : ''}`],
  ];
  const awardsHtml = (aw) => `<div class="ml-awards">${AWARDS.filter(([k]) => aw[k]).map(([k, ic, label, txt], i) => `<div class="ml-award ${k}" style="animation-delay:${0.4 + i * 0.35}s"><div class="ic">${ic}</div><div class="lb">${label}</div><div class="nm">${aw[k].names.map(esc).join(', ')}</div><div class="muted">${txt(aw[k])}</div></div>`).join('')}</div>`;

  // ---------- TV ----------
  function tvReveal(s) {
    const res = s.result;
    if (res.kind === 'hot') {
      const seat = s.seat || { name: '?' }, tot = Math.max(1, res.yes + res.no);
      const verdict = res.verdict === null ? (res.total ? '⚖️ SPLIT! The room can’t decide.' : '🤷 Nobody answered!') : res.verdict ? `The room says <b class="ml-yes-t">YES</b>` : `The room says <b class="ml-no-t">NO</b>`;
      const said = res.seatSaid === null ? `${esc(seat.name)} stayed silent 🤐` : `${esc(seat.name)} said <b class="${res.seatSaid ? 'ml-yes-t' : 'ml-no-t'}">${res.seatSaid ? 'YES' : 'NO'}</b>${res.verdict !== null ? (res.seatSaid === res.verdict ? ' · self-aware! 😌' : ' · in denial? 😏') : ''}`;
      const col = (k, n, by) => `<div class="ml-yn ${k}"><div class="ml-yn-bar"><div class="fill" style="--h:${Math.round((n / tot) * 100)}%"></div></div><div class="ml-yn-n" data-count="${n}" data-delay="300">${n}</div><div class="ml-yn-l">${k === 'yes' ? 'YES' : 'NO'}</div>${by ? `<div class="ml-by">${by.slice(0, 14).map(esc).join(', ')}${by.length > 14 ? ` +${by.length - 14}` : ''}</div>` : ''}</div>`;
      return `<div class="ml-mini">${badge(s)}<span>Would ${dot(seat.color)}<b>${esc(seat.name)}</b> actually ${esc(s.text)}?</span></div>
        <div class="ml-hot">${col('yes', res.yes, res.yesBy)}${col('no', res.no, res.noBy)}</div>
        <div class="ml-verdict">${verdict}</div><div class="ml-said">${said}</div>
        ${res.verdict ? `<div class="ml-spot"><div class="ml-crown">👑</div><div class="ml-wname">${dot(seat.color)}${esc(seat.name)}</div><div class="ml-title">${esc(res.title)}</div></div>` : res.verdict === false ? `<div class="ml-said">${esc(seat.name)} keeps a clean record… for now.</div>` : ''}`;
    }
    if (!res.winners.length) return `${promptCard(s, 'small')}<div class="ml-verdict">🤷 Nobody voted! The mystery remains.</div>`;
    const top = res.top, max = Math.max(1, ...top.map((t) => t.votes)), rows = top.length;
    const bars = top.map((t, i) => {
      const delay = (rows - 1 - i) * 0.35; // lowest first, the winner last
      return `<div class="ml-row ${t.win ? 'win' : ''}" style="animation-delay:${delay}s"><span class="ml-rank">${t.win ? '👑' : '#' + (i + 1)}</span>${dot(t.color)}<span class="ml-name">${esc(t.name)}</span>
        <div class="ml-bar"><div class="fill" style="--w:${Math.round((t.votes / max) * 100)}%;--c:${esc(t.color)};animation-delay:${delay}s"></div></div><b class="ml-votes" data-count="${t.votes}" data-delay="${Math.round(delay * 1000)}">${t.votes}</b>
        ${t.voters ? `<div class="ml-by">${t.voters.slice(0, 16).map(esc).join(', ')}${t.voters.length > 16 ? ` +${t.voters.length - 16}` : ''}</div>` : ''}</div>`;
    }).join('');
    const tie = res.winners.length > (res.kind === 'pair' ? 2 : 1);
    return `${promptCard(s, 'small')}
      <div class="ml-reveal"><div class="ml-bars">${bars}${res.more ? `<div class="muted ml-more">+${res.more} more got votes</div>` : ''}<div class="muted ml-more">${plural(res.total, 'vote')} in${s.anon ? ' · anonymous' : ''}</div></div>
      <div class="ml-spot ${tie ? 'tie' : ''}" style="--d:2.2s"><div class="ml-crown">👑</div>${tie ? '<div class="ml-tie">IT’S A TIE! Shared title:</div>' : ''}<div class="ml-wname">${names(res.winners)}</div><div class="ml-title">${esc(res.title)}</div></div></div>`;
  }
  function hall(f) {
    // Most-titled player in the middle, the rest fanning out to both sides.
    const out = []; f.hall.forEach((x, i) => (i % 2 ? out.push(x) : out.unshift(x)));
    const champ = f.hall[0];
    return `<div class="ml-hall">${out.map((x, i) => {
      const isChamp = x === champ && x.titles.length;
      return `<div class="ml-plaque ${isChamp ? 'champ' : ''} ${x.titles.length ? '' : 'none'}" style="--c:${esc(x.color)};animation-delay:${(i * 0.06).toFixed(2)}s"><div class="ml-pname">${isChamp ? '👑 ' : ''}${esc(x.name)}<span class="ml-pc">${x.titles.length}</span></div>
        ${x.titles.length ? `<ul>${x.titles.slice(0, isChamp ? 5 : 3).map((t) => `<li>${esc(t)}</li>`).join('')}${x.titles.length > (isChamp ? 5 : 3) ? `<li class="muted">+${x.titles.length - (isChamp ? 5 : 3)} more</li>` : ''}</ul>` : '<div class="muted ml-quiet">A person of mystery ✨</div>'}</div>`;
    }).join('')}${f.hallMore ? `<div class="muted ml-more">+${f.hallMore} more players</div>` : ''}</div>`;
  }

  // ---------- phone ----------
  function grid(v, ctx, { mode, chosen, disableSelf }) {
    const list = v.choices || [], big = list.length > 12;
    const btns = list.map((c) => {
      const self = c.id === v.me, off = self && disableSelf, sel = chosen.includes(c.id);
      return `<button class="ml-pick ${sel ? 'sel' : ''} ${self ? 'me' : ''}" data-id="${esc(c.id)}" data-n="${esc(c.name.toLowerCase())}" ${off ? 'disabled' : ''}>${dot(c.color)}<span>${esc(c.name)}</span>${self ? '<small>you</small>' : ''}${sel ? '<em>✓</em>' : ''}</button>`;
    }).join('');
    return `${big ? `<input class="ml-search" id="ml-q" type="search" placeholder="🔎 Search ${list.length} names…" autocomplete="off">` : ''}<div class="ml-grid ${mode}" id="ml-grid">${btns}</div>`;
  }
  function bindGrid(el, onPick) {
    const g = el.querySelector('#ml-grid'); if (!g) return;
    g.scrollTop = scroll; g.onscroll = () => { scroll = g.scrollTop; };
    const inp = el.querySelector('#ml-q');
    // The search text lives here, not in the HTML, so typing never forces a repaint.
    const filter = () => { const ql = q.trim().toLowerCase(); for (const b of g.querySelectorAll('[data-n]')) b.hidden = !!ql && !b.dataset.n.includes(ql); };
    if (inp) { inp.value = q; inp.oninput = () => { q = inp.value; filter(); }; }
    filter();
    for (const b of g.querySelectorAll('[data-id]')) b.onclick = () => onPick(b.dataset.id);
  }
  const resetGrid = () => { q = ''; scroll = 0; };

  function phoneVote(v, ctx, head) {
    const key = v.n + ':' + v.phase, t = timer('p' + key, v.endsIn);
    const card = promptCard(v, 'phone');
    if (!v.inRound) return { html: `${head}${card}<div class="big-status">You’re in from the next prompt! 🎟️</div>` };
    const nameOf = (id) => { const c = (v.choices || []).find((x) => x.id === id); return c ? `${dot(c.color)}${esc(c.name)}` : '?'; };
    if (edit && edit.key !== key) edit = null;
    if (v.kind === 'hot') {
      const voteStep = v.myVote === null || (edit && edit.step === 'vote');
      const predStep = !voteStep && ((v.myPred === null && !v.skipped) || (edit && edit.step === 'pred'));
      const yn = (cur) => `<div class="ml-ynbtns"><button class="ml-ybtn ${cur === true ? 'sel' : ''}" data-yes="1">👍 YES</button><button class="ml-nbtn ${cur === false ? 'sel' : ''}" data-yes="0">👎 NO</button></div>`;
      if (voteStep) return { html: `${head}${card}<div class="ml-step">${v.isSeat ? '🔥 You’re in the hot seat! Would you <b>actually</b> do it? Be honest…' : `Would ${esc(v.seat.name)} <b>actually</b> do it?`} ${t}</div>${yn(v.myVote)}`, bind: (el) => bindYes(el, ctx, 'vote', key) };
      if (predStep) return { html: `${head}${card}<div class="ml-step">🔮 ${v.isSeat ? 'What will the <b>room</b> say about you?' : `What will <b>${esc(v.seat.name)}</b> say about themself?`} <span class="muted">(+150)</span> ${t}</div>${yn(v.myPred)}<button class="btn ghost small ml-skip" id="ml-skip">Skip prediction</button>`, bind: (el) => { bindYes(el, ctx, 'predict', key); bindSkip(el, ctx); } };
      const yesno = (b) => (b === true ? '<b class="ml-yes-t">YES</b>' : b === false ? '<b class="ml-no-t">NO</b>' : '—');
      return { html: `${head}${card}<div class="card-box ml-locked"><div class="big-status">Locked in ✅</div><p>Your answer: ${yesno(v.myVote)} <button class="ml-link" data-edit="vote">change</button></p><p>🔮 Prediction: ${v.skipped && v.myPred === null ? 'skipped' : yesno(v.myPred)} <button class="ml-link" data-edit="pred">change</button></p><p class="muted">Waiting for the room… ${t}</p></div>`, bind: (el) => bindEdit(el, ctx, key) };
    }
    const pair = v.kind === 'pair';
    const voteStep = v.myVote === null || (edit && edit.step === 'vote');
    const predStep = !voteStep && ((v.myPred === null && !v.skipped) || (edit && edit.step === 'pred'));
    if (voteStep) {
      if (duoKey !== key) { duoKey = key; duo = Array.isArray(v.myVote) ? v.myVote.slice() : []; }
      const chosen = pair ? duo : v.myVote ? [v.myVote] : [];
      const step = pair ? `👯 Pick <b>two</b> people <span class="muted">(${duo.length}/2)</span>` : '🗳️ Tap a name to vote';
      return {
        html: `${head}${card}<div class="ml-step">${step} ${t}</div>${grid(v, ctx, { mode: 'vote', chosen, disableSelf: !v.selfVote })}${pair ? `<button class="btn big green ml-go" id="ml-duo" ${duo.length === 2 ? '' : 'disabled'}>Lock in the duo 👯</button>` : ''}`,
        bind: (el) => {
          bindGrid(el, async (id) => {
            if (pair) { const k = duo.indexOf(id); if (k >= 0) duo.splice(k, 1); else { if (duo.length >= 2) duo.shift(); duo.push(id); } ctx.vibrate(10); ctx.redraw(); return; }
            const r = await ctx.act({ op: 'vote', id }); if (r && r.ok) { ctx.vibrate(25); ctx.sfx('pop'); edit = null; resetGrid(); ctx.redraw(); }
          });
          const d = el.querySelector('#ml-duo'); if (d) d.onclick = async () => { const r = await ctx.act({ op: 'vote', ids: duo }); if (r && r.ok) { ctx.vibrate(25); ctx.sfx('pop'); edit = null; resetGrid(); ctx.redraw(); } };
        },
      };
    }
    if (predStep) {
      return {
        html: `${head}${card}<div class="ml-step">🔮 Prediction: who will the <b>room</b> ${pair ? 'put in the duo' : 'pick'}? <span class="muted">(+150)</span> ${t}</div>${grid(v, ctx, { mode: 'pred', chosen: v.myPred ? [v.myPred] : [], disableSelf: false })}<button class="btn ghost small ml-skip" id="ml-skip">Skip prediction</button>`,
        bind: (el) => { bindGrid(el, async (id) => { const r = await ctx.act({ op: 'predict', id }); if (r && r.ok) { ctx.vibrate(25); ctx.sfx('chime'); edit = null; resetGrid(); ctx.redraw(); } }); bindSkip(el, ctx); },
      };
    }
    const voted = Array.isArray(v.myVote) ? v.myVote.map(nameOf).join(' &amp; ') : nameOf(v.myVote);
    return { html: `${head}${card}<div class="card-box ml-locked"><div class="big-status">Locked in ✅</div><p>Your vote: <b>${voted}</b> <button class="ml-link" data-edit="vote">change</button></p><p>🔮 Prediction: <b>${v.myPred ? nameOf(v.myPred) : 'skipped'}</b> <button class="ml-link" data-edit="pred">change</button></p><p class="muted">Waiting for the room… ${t}</p></div>`, bind: (el) => bindEdit(el, ctx, key) };
  }
  function bindYes(el, ctx, op, key) {
    for (const b of el.querySelectorAll('[data-yes]')) b.onclick = async () => { const r = await ctx.act({ op, yes: b.dataset.yes === '1' }); if (r && r.ok) { ctx.vibrate(25); ctx.sfx(op === 'vote' ? 'pop' : 'chime'); edit = null; ctx.redraw(); } };
  }
  function bindSkip(el, ctx) { const s = el.querySelector('#ml-skip'); if (s) s.onclick = async () => { const r = await ctx.act({ op: 'skip' }); if (r && r.ok) { edit = null; resetGrid(); ctx.redraw(); } }; }
  function bindEdit(el, ctx, key) { for (const b of el.querySelectorAll('[data-edit]')) b.onclick = () => { edit = { key, step: b.dataset.edit }; resetGrid(); ctx.redraw(); }; }

  BOX.games.likely = {
    name: 'Most Likely To…', icon: '👑',
    about: 'Who’s most likely to survive a zombie apocalypse? Vote for your friends, predict the room, and collect ridiculous titles.',
    how: [
      'A prompt goes up on the big screen: “Who’s most likely to…?”',
      'Vote for a player on your phone, then predict who the room will pick.',
      '+100 if your vote matches the room’s winner, +150 for a correct prediction.',
      'The winner gets crowned with a new TITLE. Ties share the crown!',
      'Bonus rounds: 👯 Double Trouble (pick two people) and 🔥 Hot Seat (“Would they actually do it?” YES or NO).',
      'At the end: the Hall of Titles and awards for the best room readers.',
    ],
    fx: { prompt: 'whoosh', bonus: 'sting', open: 'tick', allin: 'chime', drum: 'drum', reveal: 'reveal', none: 'shrug', crown: 'cheer', yes: 'gasp', no: 'poof', split: 'shrug', win: 'win' },

    tv(el, s) {
      if (!s) return;
      if (s.phase === 'over' && s.final) {
        const f = s.final;
        paint(el, `<div class="ml-over"><h1 class="ml-h">🏛️ Hall of Titles</h1>${hall(f)}${awardsHtml(f.awards)}
          <div class="ml-final-board"><h3>Best room readers</h3>${BOX.board(f.standings, (r) => r.points, ' pts')}</div></div>`);
        return;
      }
      const key = s.n + ':' + s.phase, t = timer('t' + key, s.endsIn);
      let main = '';
      if (s.phase === 'intro') {
        main = `<div class="ml-intro">${s.kind === 'classic' ? '' : `<div class="ml-sweep ${s.kind}">${s.kind === 'hot' ? '🔥 HOT SEAT 🔥' : '👯 DOUBLE TROUBLE 👯'}</div>`}${promptCard(s, 'in')}
          <div class="ml-status">${s.kind === 'hot' ? `Everyone answers YES or NO about ${esc(s.seat ? s.seat.name : '')}…` : s.kind === 'pair' ? 'Pick TWO people this time!' : 'Get your phones ready…'} ${t}</div></div>`;
      } else if (s.phase === 'vote') {
        const pct = s.of ? Math.round((s.voted / s.of) * 100) : 0;
        main = `${promptCard(s)}<div class="ml-status">🗳️ Vote on your phone! ${t}</div>
          <div class="ml-progress"><div class="fill" style="width:${pct}%"></div><span>${s.voted} / ${s.of} votes in · 🔮 ${s.predicted} predictions</span></div>
          ${s.waiting && s.waiting.length ? `<div class="ml-waiting">Still deciding: ${s.waiting.map(esc).join(', ')}</div>` : s.waiting ? '<div class="ml-waiting">Everyone’s in! 🎉</div>' : ''}`;
      } else if (s.phase === 'drum') {
        main = `${promptCard(s, 'shake')}<div class="ml-drum">🥁</div><div class="ml-status">${plural(s.voted, 'vote')} in… the room has spoken.</div>`;
      } else if (s.phase === 'reveal' && s.result) main = tvReveal(s);
      const bonus = s.kind === 'hot' ? ' · 🔥 Hot Seat' : s.kind === 'pair' ? ' · 👯 Double Trouble' : '';
      paint(el, `<div class="ml-wrap"><section class="ml-main"><div class="ml-top"><span>Prompt <b>${s.n}</b> of ${s.total}${bonus}</span><span class="muted">${s.anon ? '🙈 Anonymous votes' : '👀 Public votes'}</span></div>${main}</section>
        <aside class="panel ml-side"><h3>Room readers</h3>${s.standings.length ? s.standings.map((r, i) => `<div class="ml-srow"><span class="n">${i + 1}</span>${dot(r.color)}<span class="nm">${esc(r.name)}</span>${r.titles ? `<span class="ml-tc">👑${r.titles}</span>` : ''}<b>${r.points}</b></div>`).join('') : ''}</aside></div>`, () => countUp(el));
    },

    phone(el, v, ctx) {
      if (!v) return;
      const head = `<div class="ml-me"><span>🏅 ${v.points} pts · #${v.rank || '-'}</span><span>👑 ${v.myTitles.length}</span><span class="muted">${v.n}/${v.total}</span></div>`;
      if (v.phase === 'over' && v.final) {
        paint(el, `<div class="card-box" style="text-align:center"><h3>Game over!</h3><p>You finished <b>#${v.rank}</b> with ${v.points} points.</p></div>
          <div class="card-box"><h3>👑 Your titles</h3>${v.myTitles.length ? `<ul class="ml-mytitles">${v.myTitles.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '<p class="muted">No titles this time: you’re a person of mystery ✨</p>'}</div>
          ${awardsHtml(v.final.awards)}<div class="card-box">${BOX.board(v.final.standings, (r) => r.points, ' pts')}</div>`);
        return;
      }
      let out;
      if (v.phase === 'intro') out = { html: `${head}${promptCard(v, 'phone in')}<div class="big-status">${v.isSeat ? '🔥 You’re in the HOT SEAT!' : v.kind === 'pair' ? '👯 Double Trouble: pick two!' : 'Get ready to vote…'}</div>` };
      else if (v.phase === 'vote') out = phoneVote(v, ctx, head);
      else if (v.phase === 'drum') out = { html: `${head}${promptCard(v, 'phone')}<div class="big-status ml-pulse">🥁 Drumroll… eyes on the TV!</div>` };
      else if (v.phase === 'reveal' && v.result) {
        const m = v.mine || {}, r = v.result, lines = [];
        if (m.won) lines.push(`<div class="ml-you-won">👑 You got the title!<div class="ml-title">${esc(r.title)}</div></div>`);
        if (v.kind === 'hot') {
          lines.push(`<p>The room said <b class="${r.verdict ? 'ml-yes-t' : 'ml-no-t'}">${r.verdict === null ? 'SPLIT' : r.verdict ? 'YES' : 'NO'}</b> (${r.yes}–${r.no})${r.seatSaid !== null && !v.isSeat ? ` · ${esc(v.seat.name)} said ${r.seatSaid ? 'YES' : 'NO'}` : ''}</p>`);
        } else lines.push(r.winners.length ? `<p>${r.winners.length > 1 && v.kind !== 'pair' ? 'Shared title: ' : ''}${names(r.winners)}</p>` : '<p>Nobody voted!</p>');
        if (m.matched) { const hits = Array.isArray(m.vote) ? m.vote.filter((id) => r.winners.some((w) => w.id === id)).length * 50 : 100; lines.push(`<div class="ml-gain">+${hits} You read the room 📖</div>`); }
        if (m.foresaw) lines.push('<div class="ml-gain">+150 Fortune teller 🔮</div>');
        if (!m.matched && !m.foresaw && m.vote != null) lines.push('<p class="muted">The room disagreed with you this time 🙃</p>');
        if (m.vote == null && v.inRound) lines.push('<p class="muted">You didn’t vote this time.</p>');
        out = { html: `${head}<div class="card-box ml-result">${lines.join('')}${m.gained ? `<div class="ml-total">+${m.gained} this round</div>` : ''}</div>` };
        const k = String(v.n);
        if (celebrated !== k) { celebrated = k; if (m.won) { ctx.sfx('win'); ctx.vibrate(150); } else if (m.gained) { ctx.sfx('chime'); ctx.vibrate(40); } }
      } else out = { html: `${head}<div class="big-status">Next prompt coming…</div>` };
      if (paint(el, out.html) && out.bind) out.bind(el);
    },
  };
})();
