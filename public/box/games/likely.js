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
  // Players as their JustGameBox character (public/box/portrait.js), or their emoji without one.
  const has = (x) => !!(x && BOX.hasLook && BOX.hasLook(x));
  const face = (x, n, o) => (BOX.face ? BOX.face(x, n, o) : esc((x && x.avatar) || '🙂'));
  const av = (x, n = 28) => (x && (x.avatar || has(x)) ? face(x, n, { cls: 'ml-af' }) + ' ' : '');
  // A nominee: their character standing on the carpet, or the old bow-tied blob with their emoji.
  const nominee = (p) => (has(p) ? `<span class="bd has-fig">${BOX.body(p, 100, { cls: 'ml-fig' })}</span>` : `<span class="bd"><span class="f">${esc(p.avatar || '🙂')}</span></span>`);
  // The crowned winner(s), full body under the spotlight.
  const winFigs = (list) => { const w = (list || []).filter(has).slice(0, 4); return w.length ? `<div class="ml-wfigs">${w.map((x) => BOX.body(x, w.length > 1 ? 150 : 190, { mood: 'grin' })).join('')}</div>` : ''; };
  const dot = (c) => `<i class="ml-dot" style="background:${esc(c || '#888')}"></i>`;
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const lead = (s) => (s.kind === 'pair' ? 'Which <b>two</b> are most likely to…' : s.kind === 'hot' ? `Would ${dot(s.seat && s.seat.color)}<b>${av(s.seat)}${esc(s.seat ? s.seat.name : '?')}</b> actually…` : 'Who’s most likely to…');
  const badge = (s) => (s.kind === 'pair' ? '<div class="ml-badge pair">👯 DOUBLE TROUBLE</div>' : s.kind === 'hot' ? '<div class="ml-badge hot">🔥 HOT SEAT</div>' : '');
  const promptCard = (s, cls = '') => `<div class="ml-card ${s.kind} ${cls}">${badge(s)}<div class="ml-lead">${lead(s)}</div><div class="ml-text">${esc(s.text)}?</div></div>`;
  // Hot Seat: the person in the seat stands beside the prompt.
  const seated = (s, card) => (s.kind === 'hot' && has(s.seat) ? `<div class="ml-hotrow"><div class="ml-hotfig">${BOX.body(s.seat, 200, { mood: s.phase === 'drum' ? 'surprised' : 'smirk' })}<span>🔥</span></div>${card}</div>` : card);
  const names = (list) => list.map((w) => `${dot(w.color)}${has(w) ? '' : av(w)}${esc(w.name)}`).join(' <span class="muted">&amp;</span> ');
  // Update in place (BOX.morph). Each phase of each prompt gets its own root id, so a new phase
  // starts fresh (its entrance animations play once) while re-renders within it never restart them.
  // Returns true the first time a given key is painted.
  function paint(el, html, key) {
    const fresh = el._mlKey !== key;
    el._mlKey = key;
    if (!fresh && el._mlHtml === html) return false;
    el._mlHtml = html;
    BOX.morph(el, `<div class="ml-root" id="ml-${esc(key)}">${html}</div>`);
    return fresh;
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
        ${res.verdict ? `<div class="ml-spot"><div class="ml-crown">👑</div>${winFigs([seat])}<div class="ml-wname">${dot(seat.color)}${esc(seat.name)}</div><div class="ml-title">${esc(res.title)}</div></div>` : res.verdict === false ? `<div class="ml-said">${esc(seat.name)} keeps a clean record… for now.</div>` : ''}`;
    }
    if (!res.winners.length) return `${promptCard(s, 'small')}<div class="ml-verdict">🤷 Nobody voted! The mystery remains.</div>`;
    const top = res.top, max = Math.max(1, ...top.map((t) => t.votes)), rows = top.length;
    const bars = top.map((t, i) => {
      const delay = (rows - 1 - i) * 0.35; // lowest first, the winner last
      return `<div class="ml-row ${t.win ? 'win' : ''}" style="animation-delay:${delay}s"><span class="ml-rank">${t.win ? '👑' : '#' + (i + 1)}</span>${dot(t.color)}<span class="ml-name">${av(t)}${esc(t.name)}</span>
        <div class="ml-bar"><div class="fill" style="--w:${Math.round((t.votes / max) * 100)}%;--c:${esc(t.color)};animation-delay:${delay}s"></div></div><b class="ml-votes" data-count="${t.votes}" data-delay="${Math.round(delay * 1000)}">${t.votes}</b>
        ${t.voters ? `<div class="ml-by">${t.voters.slice(0, 16).map(esc).join(', ')}${t.voters.length > 16 ? ` +${t.voters.length - 16}` : ''}</div>` : ''}</div>`;
    }).join('');
    const tie = res.winners.length > (res.kind === 'pair' ? 2 : 1);
    return `${promptCard(s, 'small')}
      <div class="ml-reveal"><div class="ml-bars">${bars}${res.more ? `<div class="muted ml-more">+${res.more} more got votes</div>` : ''}<div class="muted ml-more">${plural(res.total, 'vote')} in${s.anon ? ' · anonymous' : ''}</div></div>
      <div class="ml-spot ${tie ? 'tie' : ''}" style="--d:2.2s"><div class="ml-crown">👑</div>${winFigs(res.winners)}${tie ? '<div class="ml-tie">IT’S A TIE! Shared title:</div>' : ''}<div class="ml-wname">${names(res.winners)}</div><div class="ml-title">${esc(res.title)}</div></div></div>`;
  }
  function hall(f) {
    // Most-titled player in the middle, the rest fanning out to both sides.
    const out = []; f.hall.forEach((x, i) => (i % 2 ? out.push(x) : out.unshift(x)));
    const champ = f.hall[0];
    return `<div class="ml-hall">${out.map((x, i) => {
      const isChamp = x === champ && x.titles.length;
      return `<div class="ml-plaque ${isChamp ? 'champ' : ''} ${x.titles.length ? '' : 'none'}" style="--c:${esc(x.color)};animation-delay:${(i * 0.06).toFixed(2)}s"><div class="ml-pname">${isChamp ? '👑 ' : ''}${av(x)}${esc(x.name)}<span class="ml-pc">${x.titles.length}</span></div>
        ${x.titles.length ? `<ul>${x.titles.slice(0, isChamp ? 5 : 3).map((t) => `<li>${esc(t)}</li>`).join('')}${x.titles.length > (isChamp ? 5 : 3) ? `<li class="muted">+${x.titles.length - (isChamp ? 5 : 3)} more</li>` : ''}</ul>` : '<div class="muted ml-quiet">A person of mystery ✨</div>'}</div>`;
    }).join('')}${f.hallMore ? `<div class="muted ml-more">+${f.hallMore} more players</div>` : ''}</div>`;
  }

  // The nominees on the stage floor: ballots go up as people vote, the winner gets the crown.
  function carpet(s, ctx) {
    const all = (ctx && ctx.players) || [];
    if (!all.length || all.length > 40) return '';
    const show = all.slice(0, 16), wait = s.waiting ? new Set(s.waiting) : null;
    const res = s.phase === 'reveal' && s.result, win = new Set(res ? (res.kind === 'hot' ? (res.verdict && s.seat ? [s.seat.name] : []) : (res.winners || []).map((w) => w.name)) : []);
    return `<div class="ml-carpet ${s.phase}"><div class="mll-noms ingame ${show.length > 12 ? 'many' : ''}">${show.map((p, i) => {
      const voted = s.phase === 'vote' && wait && !wait.has(p.name), w = win.has(p.name);
      return `<span class="chip ${voted ? 'voted' : ''} ${w ? 'vip win' : ''} ${res && !w ? 'look' : ''}" style="--c:${esc(p.color || '#ff6b8b')};--d:${((i * 0.23) % 2.4).toFixed(2)}s">${nominee(p)}<b>${esc(p.name)}</b></span>`;
    }).join('')}${all.length > show.length ? `<span class="ml-cmore">+${all.length - show.length}</span>` : ''}</div></div>`;
  }

  // ---------- phone ----------
  function grid(v, ctx, { mode, chosen, disableSelf }) {
    const list = v.choices || [], big = list.length > 12;
    const btns = list.map((c) => {
      const self = c.id === v.me, off = self && disableSelf, sel = chosen.includes(c.id);
      return `<button class="ml-pick ${sel ? 'sel' : ''} ${self ? 'me' : ''}" data-id="${esc(c.id)}" data-n="${esc(c.name.toLowerCase())}" ${off ? 'disabled' : ''}>${dot(c.color)}<span>${av(c)}${esc(c.name)}</span>${self ? '<small>you</small>' : ''}${sel ? '<em>✓</em>' : ''}</button>`;
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
  // Haptics (ctx.haptic on new phones; a plain vibration otherwise). feel() buzzes once per moment.
  function haptic(ctx, kind) { try { if (ctx.haptic) ctx.haptic(kind); else ctx.vibrate(kind === 'tap' ? 10 : 40); } catch { /* no vibration */ } }
  let felt = {};
  const feel = (ctx, chan, key, kind) => { if (felt[chan] === key) return; felt[chan] = key; haptic(ctx, kind); };

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
      return { html: `${head}${card}<div class="card-box ml-locked"><div class="ml-sealed">✉️</div><div class="big-status">Ballot sealed!</div><p>Your answer: ${yesno(v.myVote)} <button class="ml-link" data-edit="vote">change</button></p><p>🔮 Prediction: ${v.skipped && v.myPred === null ? 'skipped' : yesno(v.myPred)} <button class="ml-link" data-edit="pred">change</button></p><p class="muted">Waiting for the room… ${t}</p></div>`, bind: (el) => bindEdit(el, ctx, key) };
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
            if (pair) { const k = duo.indexOf(id); if (k >= 0) duo.splice(k, 1); else { if (duo.length >= 2) duo.shift(); duo.push(id); } haptic(ctx, 'tap'); ctx.redraw(); return; }
            const r = await ctx.act({ op: 'vote', id }); if (r && r.ok) { haptic(ctx, 'success'); ctx.sfx('pop'); edit = null; resetGrid(); ctx.redraw(); }
          });
          const d = el.querySelector('#ml-duo'); if (d) d.onclick = async () => { const r = await ctx.act({ op: 'vote', ids: duo }); if (r && r.ok) { haptic(ctx, 'success'); ctx.sfx('pop'); edit = null; resetGrid(); ctx.redraw(); } };
        },
      };
    }
    if (predStep) {
      return {
        html: `${head}${card}<div class="ml-step">🔮 Prediction: who will the <b>room</b> ${pair ? 'put in the duo' : 'pick'}? <span class="muted">(+150)</span> ${t}</div>${grid(v, ctx, { mode: 'pred', chosen: v.myPred ? [v.myPred] : [], disableSelf: false })}<button class="btn ghost small ml-skip" id="ml-skip">Skip prediction</button>`,
        bind: (el) => { bindGrid(el, async (id) => { const r = await ctx.act({ op: 'predict', id }); if (r && r.ok) { haptic(ctx, 'select'); ctx.sfx('chime'); edit = null; resetGrid(); ctx.redraw(); } }); bindSkip(el, ctx); },
      };
    }
    const voted = Array.isArray(v.myVote) ? v.myVote.map(nameOf).join(' &amp; ') : nameOf(v.myVote);
    return { html: `${head}${card}<div class="card-box ml-locked"><div class="ml-sealed">✉️</div><div class="big-status">Ballot sealed!</div><p>Your vote: <b>${voted}</b> <button class="ml-link" data-edit="vote">change</button></p><p>🔮 Prediction: <b>${v.myPred ? nameOf(v.myPred) : 'skipped'}</b> <button class="ml-link" data-edit="pred">change</button></p><p class="muted">Waiting for the room… ${t}</p></div>`, bind: (el) => bindEdit(el, ctx, key) };
  }
  function bindYes(el, ctx, op, key) {
    for (const b of el.querySelectorAll('[data-yes]')) b.onclick = async () => { const r = await ctx.act({ op, yes: b.dataset.yes === '1' }); if (r && r.ok) { haptic(ctx, op === 'vote' ? 'success' : 'select'); ctx.sfx(op === 'vote' ? 'pop' : 'chime'); edit = null; ctx.redraw(); } };
  }
  function bindSkip(el, ctx) { const s = el.querySelector('#ml-skip'); if (s) s.onclick = async () => { const r = await ctx.act({ op: 'skip' }); if (r && r.ok) { edit = null; resetGrid(); ctx.redraw(); } }; }
  function bindEdit(el, ctx, key) { for (const b of el.querySelectorAll('[data-edit]')) b.onclick = () => { edit = { key, step: b.dataset.edit }; resetGrid(); ctx.redraw(); }; }

  // ---------- TV lobby: tonight's programme ----------
  // Each setting is a line in the awards-night programme; the chosen option is gold foil.
  // Players walk the red carpet as nominees. The real <select>s stay in #settings (hidden).
  const PROG = {
    pack: { lab: 'The Prompts', sub: 'what the awards are for', opts: { classic: '🎭 Classic', wild: '🌶️ Wild', work: '💼 Work-safe', family: '🧸 Family', holiday: '🎄 Holiday', classics: '🎬 Classics', travel: '🌍 Travel', mix: '🎲 Mix' } },
    rounds: { lab: 'Awards Tonight', sub: 'how long the show runs', opts: { 10: '10', 15: '15', 20: '20', 30: '30' } },
    voteSeconds: { lab: 'Voting Time', sub: 'seconds per ballot', opts: { 15: '15s', 20: '20s', 30: '30s' } },
    selfVote: { lab: 'Self-Nomination', sub: 'vote for yourself?', opts: { false: '🙅 Not allowed', true: '🙋 Allowed' } },
    reveal: { lab: 'The Ballots', sub: 'shown on the TV', opts: { anon: '🤫 Sealed (totals)', public: '👀 Public' } },
    showIntro: { lab: 'Opening Number', sub: 'the red-carpet intro', opts: { true: '🎺 On', false: '⏩ Skip' } },
  };
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  function lobbyTv(el, L) {
    el.__L = L;
    if (!el.__mll) {
      el.__mll = true;
      el.innerHTML = `<div class="mll">
        <div class="mll-marquee"><span class="cr">👑</span><small>★ TONIGHT’S AWARDS CEREMONY ★</small><span class="t">Most Likely <em>To…</em></span></div>
        <section class="mll-prog"><div class="mll-ph"><b>The Programme</b><span>Tap to change</span></div><div id="mll-lines"></div><div id="settings" class="mll-sr"></div></section>
        <aside class="mll-pass"><div class="mll-pt"><small>ADMIT ALL · VIP</small>Join on your phone</div><img id="qr" alt="QR code to join"><div class="mll-url" id="mll-url"></div>
          <div class="mll-codecap">ROOM CODE</div><div class="mll-code" id="code"></div><div class="mll-vip" id="mll-vip"></div><div class="err" id="lobby-err"></div>
          <button class="mll-start" id="start">🏆 Raise the curtain</button>
          <div class="mll-links"><button id="add-bots">+ 5 test bots</button><button id="rm-bots">remove bots</button><button id="mll-pick">🎮 Other game</button></div></aside>
        <section class="mll-carpet"><div class="mll-tally" id="mll-tally"></div><div class="mll-noms" id="roster"></div></section>
        <div class="mll-party" id="mll-party"></div></div>`;
      const $ = (s) => el.querySelector(s);
      $('#start').onclick = async () => { const r = await el.__L.start(); $('#lobby-err').textContent = r && r.ok ? '' : (r && r.error) || ''; };
      $('#add-bots').onclick = () => el.__L.bots(5);
      $('#rm-bots').onclick = () => el.__L.removeBots();
      $('#mll-pick').onclick = () => el.__L.pick();
      el.addEventListener('click', (e) => {
        const k = e.target.closest('[data-k]');
        if (k) {
          for (const b of k.parentNode.querySelectorAll('.mll-opt')) b.classList.toggle('on', b === k);
          const s = el.querySelector(`select[data-set="${k.dataset.k}"]`); if (s) s.value = k.dataset.v;
          el.__L.set(k.dataset.k, k.dataset.v); BOX.sfx('ballot'); return;
        }
        const c = e.target.closest('[data-kick]');
        if (c && confirm('Remove this player?')) el.__L.kick(c.dataset.kick);
      });
    }
    const $ = (s) => el.querySelector(s);
    if ($('#code').textContent !== L.code) $('#code').textContent = L.code;
    if ($('#qr').dataset.u !== L.joinUrl) { $('#qr').src = L.qr; $('#qr').dataset.u = L.joinUrl; }
    $('#mll-url').textContent = L.joinUrl.replace(/^https?:\/\//, '');
    const n = L.players.length;
    $('#start').disabled = n < L.min;
    $('#mll-vip').innerHTML = L.vip ? `👑 <b>${esc(L.vip)}</b> can start from their phone` : n < L.min ? `${L.min - n} more nominee${L.min - n === 1 ? '' : 's'} needed…` : 'The first to arrive hosts 👑';
    BOX.morph($('#mll-tally'), `${n}<small>NOMINEE${n === 1 ? '' : 'S'}</small>`);
    const html = L.fields.map((f, i) => {
      const P = PROG[f.key] || { lab: f.label, opts: {} }, cur = String(L.settings[f.key]);
      return `<div class="mll-line"><span class="mll-num">${ROMAN[i] || i + 1}</span><div class="mll-lab">${esc(P.lab)}${P.sub ? `<small>${esc(P.sub)}</small>` : ''}</div>
        <div class="mll-opts">${f.options.map((o) => `<button class="mll-opt ${String(o.value) === cur ? 'on' : ''}" data-k="${esc(f.key)}" data-v="${esc(String(o.value))}" title="${esc(o.label)}">${esc(P.opts[String(o.value)] || o.label)}</button>`).join('')}</div></div>`;
    }).join('');
    const lines = $('#mll-lines'); if (lines.__h !== html) { lines.__h = html; BOX.morph(lines, html); }
    const box = $('#settings'), sig = L.fields.map((f) => f.key + ':' + f.options.map((o) => o.value).join('|')).join(';');
    if (box.__sig !== sig) { box.__sig = sig; box.innerHTML = L.fields.map((f) => `<label>${esc(f.label)}<select data-set="${esc(f.key)}">${f.options.map((o) => `<option value="${esc(String(o.value))}">${esc(o.label)}</option>`).join('')}</select></label>`).join(''); }
    for (const s of box.querySelectorAll('select[data-set]')) {
      if (document.activeElement !== s) s.value = String(L.settings[s.dataset.set]);
      s.onchange = () => { s.blur(); el.__L.set(s.dataset.set, s.value); };
    }
    const r = $('#roster');
    r.classList.toggle('many', n > 14 && n <= 30); r.classList.toggle('lots', n > 30);
    const rh = n ? L.players.map((p, i) => `<span class="chip ${p.online ? '' : 'off'} ${p.name === L.vip ? 'vip' : ''}" id="mll-p-${esc(p.id)}" data-kick="${esc(p.id)}" title="Click to remove" style="--c:${esc(p.color || '#ff6b8b')};--d:${((i * 0.23) % 2.4).toFixed(2)}s">${nominee(p)}<b>${esc(p.name)}</b></span>`).join('')
      : '<div class="mll-empty">The red carpet awaits its nominees… ✨</div>';
    if (r.__h !== rh) { r.__h = rh; BOX.morph(r, rh); }
    const lp = $('#mll-party'), lh = L.lineupHtml || ''; if (lp.__h !== lh) { lp.__h = lh; lp.innerHTML = lh; }
  }

  BOX.games.likely = {
    // Soundtrack cue per phase (public/box/scores/<key>.js); the TV turns the last 10 s of 'think' tense.
    music: (s) => ({ intro: 'think', vote: 'play', drum: 'tense', reveal: 'reveal', over: 'finale' }[s.phase] || 'play'),
    name: 'Most Likely To…', icon: '👑', lobbyTv,
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

    tv(el, s, ctx) {
      if (!s) return;
      if (s.phase === 'over' && s.final) {
        const f = s.final;
        paint(el, `<div class="ml-over"><h1 class="ml-h">🏛️ Hall of Titles</h1>${hall(f)}${awardsHtml(f.awards)}
          <div class="ml-final-board"><h3>Best room readers</h3>${`<div class="board">${f.standings.map((r, i) => `<div class="row"><span class="n">${i + 1}</span><span>${av(r, 30)}${esc(r.name)}</span><b>${esc(r.points)} pts</b></div>`).join('')}</div>`}</div></div>`, 'over');
        return;
      }
      const key = s.n + ':' + s.phase, t = timer('t' + key, s.endsIn);
      let main = '';
      if (s.phase === 'intro') {
        main = `<div class="ml-intro">${s.last ? `<div class="ml-sweep final">🏁 FINAL PROMPT · POINTS ×${s.mult} 🏁</div>` : ''}${s.kind === 'classic' ? '' : `<div class="ml-sweep ${s.kind}">${s.kind === 'hot' ? '🔥 HOT SEAT 🔥' : '👯 DOUBLE TROUBLE 👯'}</div>`}${seated(s, promptCard(s, 'in'))}
          <div class="ml-status">${s.kind === 'hot' ? `Everyone answers YES or NO about ${esc(s.seat ? s.seat.name : '')}…` : s.kind === 'pair' ? 'Pick TWO people this time!' : 'Get your phones ready…'} ${t}</div></div>`;
      } else if (s.phase === 'vote') {
        const pct = s.of ? Math.round((s.voted / s.of) * 100) : 0;
        main = `${seated(s, promptCard(s))}<div class="ml-status">🗳️ Vote on your phone! ${t}</div>
          <div class="ml-progress"><div class="fill" style="width:${pct}%"></div><span>${s.voted} / ${s.of} votes in · 🔮 ${s.predicted} predictions</span></div>
          ${s.waiting && s.waiting.length ? `<div class="ml-waiting">Still deciding: ${s.waiting.map(esc).join(', ')}</div>` : s.waiting ? '<div class="ml-waiting">Everyone’s in! 🎉</div>' : ''}`;
      } else if (s.phase === 'drum') {
        main = `${seated(s, promptCard(s, 'shake'))}<div class="ml-drum"><span>🥁</span></div><div class="ml-status">${plural(s.voted, 'vote')} in… the room has spoken.</div>`;
      } else if (s.phase === 'reveal' && s.result) main = tvReveal(s);
      const bonus = (s.kind === 'hot' ? ' · 🔥 Hot Seat' : s.kind === 'pair' ? ' · 👯 Double Trouble' : '') + (s.last ? ` · <span class="ml-final">🏁 FINAL ×${s.mult}</span>` : '');
      const fresh = paint(el, `<div class="ml-wrap"><section class="ml-main"><div class="ml-top"><span>Prompt <b>${s.n}</b> of ${s.total}${bonus}</span><span class="muted">${s.anon ? '🙈 Anonymous votes' : '👀 Public votes'}</span></div>${main}</section>
        <aside class="panel ml-side"><h3>Room readers</h3>${s.standings.length ? s.standings.map((r, i) => `<div class="ml-srow"><span class="n">${i + 1}</span>${dot(r.color)}<span class="nm">${av(r)}${esc(r.name)}</span>${r.titles ? `<span class="ml-tc">👑${r.titles}</span>` : ''}<b>${r.points}</b></div>`).join('') : ''}</aside></div>${carpet(s, ctx)}`, key);
      if (fresh && s.phase === 'reveal') countUp(el);
    },

    phone(el, v, ctx) {
      // JustGold gear: this game's phone theme, a frame and badge over your screen (public/shared/gear.js).
      if (window.MT_GEAR) window.MT_GEAR.phoneTheme(el, arguments[3], 'likely');
      if (!v) return;
      const head = `<div class="ml-me"><span>🏅 ${v.points} pts · #${v.rank || '-'}</span><span>👑 ${v.myTitles.length}</span>${v.last ? `<span class="ml-final">🏁 Final ×${v.mult}</span>` : `<span class="muted">${v.n}/${v.total}</span>`}</div>`;
      if (v.phase === 'over' && v.final) {
        feel(ctx, 'over', 1, v.rank === 1 ? 'win' : 'success');
        paint(el, `<div class="card-box" style="text-align:center"><div class="ml-place">${v.rank === 1 ? '🏆' : v.rank === 2 ? '🥈' : v.rank === 3 ? '🥉' : '👑'}</div><h3>You finished #${v.rank} of ${v.of}</h3><p>${v.points} points · ${v.myTitles.length} title${v.myTitles.length === 1 ? '' : 's'}</p></div>
          <div class="card-box"><h3>👑 Your titles</h3>${v.myTitles.length ? `<ul class="ml-mytitles">${v.myTitles.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '<p class="muted">No titles this time: you’re a person of mystery ✨</p>'}</div>
          ${awardsHtml(v.final.awards)}<div class="card-box">${BOX.board(v.final.standings, (r) => r.points, ' pts')}</div>`, 'over');
        return;
      }
      if (felt.over) felt = {}; // a new game started
      if (v.phase === 'intro') feel(ctx, 'prompt', v.n, v.isSeat ? 'turn' : 'select');
      if (v.phase === 'drum') feel(ctx, 'drum', v.n, 'buzz');
      let out;
      if (v.phase === 'intro') out = { html: `${head}${promptCard(v, 'phone in')}<div class="big-status">${v.isSeat ? '🔥 You’re in the HOT SEAT!' : v.kind === 'pair' ? '👯 Double Trouble: pick two!' : 'Get ready to vote…'}</div>` };
      else if (v.phase === 'vote') out = phoneVote(v, ctx, head);
      else if (v.phase === 'drum') out = { html: `${head}<div class="ml-envelope"></div><div class="big-status">The envelope, please… 🥁</div><p class="muted" style="text-align:center">Eyes on the big screen!</p>` };
      else if (v.phase === 'reveal' && v.result) {
        const m = v.mine || {}, r = v.result, lines = [];
        if (m.won) lines.push(`<div class="ml-you-won"><div class="crown">👑</div>You got the title!<div class="ml-title">${esc(r.title)}</div></div>`);
        if (v.kind === 'hot') {
          lines.push(`<p>The room said <b class="${r.verdict ? 'ml-yes-t' : 'ml-no-t'}">${r.verdict === null ? 'SPLIT' : r.verdict ? 'YES' : 'NO'}</b> (${r.yes}–${r.no})${r.seatSaid !== null && !v.isSeat ? ` · ${esc(v.seat.name)} said ${r.seatSaid ? 'YES' : 'NO'}` : ''}</p>`);
        } else lines.push(r.winners.length ? `<p>${r.winners.length > 1 && v.kind !== 'pair' ? 'Shared title: ' : ''}${names(r.winners)}</p>` : '<p>Nobody voted!</p>');
        const mul = v.last ? v.mult : 1;
        if (v.kind !== 'hot' && m.got != null && v.inRound) lines.push(m.got ? `<p class="ml-got">🗳️ <b>${m.got}</b> ${m.got === 1 ? 'person' : 'people'} picked you${m.won ? '' : ' this time'}</p>` : '<p class="muted ml-got">🗳️ Nobody picked you this time</p>');
        if (m.matched) { const hits = (Array.isArray(m.vote) ? m.vote.filter((id) => r.winners.some((w) => w.id === id)).length * 50 : 100) * mul; lines.push(`<div class="ml-gain">+${hits} You read the room 📖</div>`); }
        if (m.foresaw) lines.push(`<div class="ml-gain">+${150 * mul} Fortune teller 🔮</div>`);
        if (!m.matched && !m.foresaw && m.vote != null) lines.push('<p class="muted">The room disagreed with you this time 🙃</p>');
        if (m.vote == null && v.inRound) lines.push('<p class="muted">You didn’t vote this time.</p>');
        out = { html: `${head}<div class="card-box ml-result">${lines.join('')}${m.gained ? `<div class="ml-total">+${m.gained} this round</div>` : ''}</div>` };
        const k = String(v.n);
        if (celebrated !== k) { celebrated = k; if (m.won) { ctx.sfx('win'); haptic(ctx, 'win'); } else if (m.gained) { ctx.sfx('chime'); haptic(ctx, 'success'); } else if (m.got) haptic(ctx, 'select'); }
      } else out = { html: `${head}<div class="big-status">Next prompt coming…</div>` };
      paint(el, out.html, v.n + '-' + v.phase);
      if (out.bind) out.bind(el);
    },
  };
})();
