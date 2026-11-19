'use strict';
// Debate Club screens. The TV is the debate hall: the motion hangs on a brass-framed plaque, two
// podiums (blue left, red right) face the crowd, the speaker gets the spotlight and a big timer
// ring, reactions float up from their podium and the crowd meter tugs between the sides. Then
// the vote, a gavel slam and the points breakdown; the Closing Ceremony hands out awards.
// Phones: debaters get their side, argument cards (tap to play one on the TV) and "I'm done";
// the audience gets a big reaction pad, a question box, the question vote and the final ballot.
(function () {
  const { esc } = BOX;
  const REACTS = [['clap', '👏', 'Applause'], ['laugh', '😂', 'LOL'], ['think', '🤔', 'Hmm…'], ['tomato', '🍅', 'Tomato!']];
  const SIDE_CLS = ['blue', 'red'];
  // Players as their JustGameBox character (public/box/portrait.js), or their emoji without one.
  const has = (x) => !!(x && BOX.hasLook && BOX.hasLook(x));
  const av = (x, n = 30, o) => (BOX.face ? BOX.face(x, n, { cls: 'db-af', ...(o || {}) }) : esc((x && x.avatar) || '🙂'));
  const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const names = (list) => list.map((m) => esc(m.name)).join(' & ');

  // A countdown end time fixed per step, so re-renders never restart it.
  const ends = {};
  const endAt = (key, endsIn) => { if (!endsIn) return 0; if (!ends[key]) ends[key] = Date.now() + endsIn; return ends[key]; };
  // The big timer ring: an SVG kept by BOX.morph (data-keep); the ticker below drives it.
  function ring(s, cls = '') {
    const end = endAt('r' + s.stepKey, s.endsIn); if (!end) return '';
    const left = Math.max(0, end - Date.now()), tot = Math.max(1, s.stepMs || 1);
    return `<div class="db-ring ${cls} ${left < 5500 ? 'low' : ''}" data-keep data-end="${end}" data-total="${tot}"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="bg" cx="60" cy="60" r="52"/><circle class="fg" cx="60" cy="60" r="52" pathLength="100" stroke-dasharray="100" stroke-dashoffset="${(100 - (100 * left) / tot).toFixed(1)}"/></svg><b>${Math.ceil(left / 1000)}</b></div>`;
  }
  setInterval(() => {
    for (const r of document.querySelectorAll('.db-ring[data-end]')) {
      const left = Math.max(0, Number(r.dataset.end) - Date.now()), tot = Number(r.dataset.total) || 1;
      const fg = r.querySelector('.fg'); if (fg) fg.setAttribute('stroke-dashoffset', (100 - (100 * left) / tot).toFixed(1));
      const b = r.querySelector('b'), sec = String(Math.ceil(left / 1000)); if (b && b.textContent !== sec) b.textContent = sec;
      if (left < 5500 && !r.classList.contains('low')) r.classList.add('low');
    }
  }, 100);

  // Update in place; each step gets its own root id so entrance animations play once per step.
  function paint(el, html, key) {
    const fresh = el._dbKey !== key; el._dbKey = key;
    if (!fresh && el._dbHtml === html) return false;
    el._dbHtml = html;
    BOX.morph(el, `<div class="db-root" id="db-${esc(key)}">${html}</div>`);
    return fresh;
  }
  function haptic(ctx, kind) { try { if (ctx.haptic) ctx.haptic(kind); else if (ctx.vibrate) ctx.vibrate(kind === 'tap' ? 10 : 40); } catch { /* none */ } }
  let felt = {};
  const feel = (ctx, chan, key, kind) => { if (felt[chan] === key) return; felt[chan] = key; haptic(ctx, kind); };

  const KIND = {
    classic: { badge: '', tag: 'THE MOTION' },
    swap: { badge: '🔄 SWAP SIDES', tag: 'THE MOTION' },
    lawyer: { badge: '⚖️ LAWYER MODE', tag: 'THE COURT IS IN SESSION' },
    hot: { badge: '🌶️ HOT TAKES', tag: 'HOT TAKE' },
    team: { badge: '👥 TEAM DEBATE', tag: 'THE MOTION' },
  };
  const kindBadge = (s) => (KIND[s.kind] && KIND[s.kind].badge ? `<span class="db-badge k-${esc(s.kind)}">${KIND[s.kind].badge}${s.kind === 'hot' ? ` ${s.mini}/${s.minis}` : ''}</span>` : '');
  const sidePill = (label, k, cls = '') => `<span class="db-pill ${SIDE_CLS[k]} ${cls}">${esc(label)}</span>`;
  function motion(s, cls = '') {
    const c = s.topic.case;
    const head = c ? `<div class="db-mtag">⚖️ THE PEOPLE vs. ${esc(c.who.toUpperCase())}</div><div class="db-mq"><span class="db-accused">${esc(c.e)}</span> ${esc(c.who)} stands accused of <u>${esc(c.crime)}</u>.</div>`
      : `<div class="db-mtag">${(KIND[s.kind] || KIND.classic).tag}</div><div class="db-mq">${esc(s.topic.q)}</div>`;
    const long = (c ? c.who.length + c.crime.length + 24 : s.topic.q.length) > 58;
    return `<div class="db-motion ${cls} ${c ? 'court' : ''} ${long ? 'long' : ''}"><i class="db-nail l"></i><i class="db-nail r"></i>${head}</div>`;
  }

  // ======================= TV =======================
  function podium(s, k, extra) {
    const P = s.podiums[k], on = P.speaking, many = P.members.length > 1;
    const t = (s.tally && s.tally[k]) || {};
    const tally = REACTS.map(([key, e]) => `<span>${e} <b>${t[key] || 0}</b></span>`).join('');
    const live = s.speakSide != null;
    return `<div class="db-pod ${SIDE_CLS[k]} ${on ? 'on' : live ? 'dim' : ''} ${many ? 'team' : ''}" id="db-pod-${k}">
      <div class="db-spot"></div>
      <div class="db-heads">${P.members.map((m) => `<div class="db-head ${has(m) ? 'has-fig' : ''} ${m.id === on ? 'talk' : ''} ${m.here ? '' : 'gone'}" style="--c:${esc(m.color)}">${has(m) ? BOX.body(m, many ? 180 : 260, { cls: 'db-fig', mood: m.id === on ? 'grin' : undefined }) : `<span>${esc(m.avatar || '🙂')}</span>`}${m.id === on ? '<i class="db-mic">🎤</i>' : ''}</div>`).join('')}</div>
      <div class="db-desk"><div class="db-plate">${names(P.members)}</div><div class="db-side" id="db-side-${k}-${esc(P.label)}">${esc(P.label)}</div>${P.role ? `<div class="db-role">${esc(P.role)}</div>` : ''}<div class="db-tally">${tally}</div></div>
      ${extra || ''}</div>`;
  }
  function meter(s) {
    const m = s.meter || [0, 0], p = [Math.max(0, m[0]), Math.max(0, m[1])], sum = p[0] + p[1];
    const left = sum ? Math.round((p[0] / sum) * 100) : 50;
    return `<div class="db-meter"><span class="db-mlab blue">${names(s.podiums[0].members)}</span><div class="db-mbar"><div class="b" style="width:${left}%"></div><div class="r" style="width:${100 - left}%"></div><i class="db-needle" style="left:${left}%"></i></div><span class="db-mlab red">${names(s.podiums[1].members)}</span><div class="db-mcap">CROWD METER</div></div>`;
  }
  const status = (txt, cls = '') => `<div class="db-status ${cls}">${txt}</div>`;

  function center(s) {
    const P = s.podiums, ph = s.phase;
    if (ph === 'intro') {
      const sub = s.kind === 'lawyer' ? `🛡️ <b>${names(P[0].members)}</b> defends ${sidePill('NOT GUILTY', 0)} · ⚖️ <b>${names(P[1].members)}</b> prosecutes ${sidePill('GUILTY', 1)}`
        : `${names(P[0].members)} argues ${sidePill(P[0].label, 0)} · ${names(P[1].members)} argues ${sidePill(P[1].label, 1)}`;
      const how = { hot: 'Twenty seconds each. No prep. Go!', team: 'Teams take turns at the mic: a new speaker every round.', lawyer: 'Defend the accused, or put it behind bars. The crowd is the jury.' }[s.kind] || 'Prep, openings, rebuttals, a question from you, and a closing line.';
      return `<div class="db-vs">VS</div><div class="db-intro-sub">${sub}</div><div class="db-how">${how}</div>`;
    }
    if (ph === 'prep') return `<div class="db-stage">📝 PREPARE!</div>${ring(s)}<div class="db-line">Debaters: check your argument cards</div><div class="db-ask-hint">❓ Audience: send the debaters a question from your phone${s.asked ? ` · <b>${s.asked}</b> sent` : ''}</div>`;
    if (ph === 'speech' || ph === 'closer') {
      const k = s.speakSide, who = s.speaker || {};
      let mid = '';
      if (ph === 'closer') {
        const line = s.closers && s.closers[k];
        mid = `<div class="db-quote ${SIDE_CLS[k]}" id="db-q-${s.stepKey}">${line ? `“${esc(line)}”` : '<i>…closing words, out loud!</i>'}<small>— ${av(who)} ${esc(who.name)}</small></div>`;
      } else if (s.stage === 'answer' && s.question) mid = `<div class="db-qcard"><small>${s.question.by ? `❓ ${esc(s.question.by)} asks` : '❓ The moderator asks'}</small>${esc(s.question.text)}</div>`;
      else if (s.card && s.card.side === k) mid = `<div class="db-played" id="db-card-${s.card.id}"><div class="db-icard"><span class="ic">${esc(s.card.icon)}</span><b>${esc(s.card.title)}</b><small>${esc(s.card.hint)}</small></div><div class="db-cap">🃏 ${esc(s.card.by)} plays a card!</div></div>`;
      else if (s.bubble && s.bubble.side === k && s.bubble.text) mid = `<div class="db-bubble ${SIDE_CLS[k]}">${esc(s.bubble.text)}</div>`;
      else mid = `<div class="db-line soft">${k === 0 ? '◀' : ''} ${ph === 'speech' && s.stage === 'hot' ? 'Hot take! Make it count.' : 'React on your phone: 👏 😂 🤔 🍅'} ${k === 1 ? '▶' : ''}</div>`;
      return `<div class="db-stage ${SIDE_CLS[k]}">${esc((s.stageLabel || '').toUpperCase())}</div><div class="db-speaker">🎤 ${av(who)} <b>${esc(who.name)}</b> <span class="muted">argues</span> ${sidePill(P[k].label, k)}</div>${ring(s, SIDE_CLS[k] + (ph === 'closer' || s.stage === 'answer' || s.card ? ' sm' : ''))}${mid}`;
    }
    if (ph === 'swap') return `<div class="db-swap">🔄 SWAP SIDES!</div><div class="db-intro-sub">${names(P[0].members)} now argues ${sidePill(P[0].label, 0, 'flip')} · ${names(P[1].members)} now argues ${sidePill(P[1].label, 1, 'flip')}</div><div class="db-how">Same debate. Opposite opinions. Good luck!</div>`;
    if (ph === 'ask') {
      if (s.choices) return `<div class="db-stage">❓ THE AUDIENCE ASKS</div>${ring(s)}<div class="db-choices">${s.choices.map((q, i) => `<div class="db-choice" style="animation-delay:${i * 0.12}s"><b>${'ABCD'[i]}</b>${esc(q.text)}</div>`).join('')}</div><div class="db-line">Pick the question on your phone · ${s.voted}/${s.crowd}</div>`;
      return `<div class="db-stage">❓ THE MODERATOR ASKS</div><div class="db-qcard big">${esc(s.question ? s.question.text : '')}</div><div class="db-line soft">The audience was shy, so the moderator asks.</div>`;
    }
    if (ph === 'write') return `<div class="db-stage">✍️ CLOSING LINES</div>${ring(s)}<div class="db-line">The debaters are writing one last line…</div><div class="db-written">${[0, 1].map((k) => `<span class="${SIDE_CLS[k]}">${s.written[k] ? '✅' : '✍️'} ${names(P[k].members)}</span>`).join('')}</div>`;
    if (ph === 'vote') {
      const wait = s.waiting && s.waiting.length ? `<div class="db-waiting">Still voting: ${s.waiting.map(esc).join(', ')}</div>` : '';
      const recall = s.closers && (s.closers[0] || s.closers[1]) ? `<div class="db-recall">${[0, 1].map((k) => (s.closers[k] ? `<q class="${SIDE_CLS[k]}">${esc(s.closers[k])}</q>` : '')).join('')}</div>` : '';
      return `<div class="db-stage gold">🗳️ THE CROWD DECIDES</div>${ring(s)}<div class="db-line">${s.kind === 'hot' ? 'Who won the hot take?' : 'Vote for the winner, then pick the best line'} · <b>${s.voted}/${s.crowd}</b></div>${recall}${wait}`;
    }
    if (ph === 'result' && s.result) {
      const r = s.result, w = r.winner;
      const head = w === null ? '<div class="db-verdict tie">⚖️ A DEAD HEAT!</div>' : `<div class="db-gavel">🔨</div><div class="db-verdict ${SIDE_CLS[w]}">${s.kind === 'lawyer' ? (w === 0 ? 'NOT GUILTY!' : 'GUILTY!') : `${names(P[w].members)} ${P[w].members.length > 1 ? 'win' : 'wins'}!`}</div>`;
      const bars = `<div class="db-bars"><div class="b" style="--w:${r.share[0]}%"><span>${r.share[0]}%</span></div><div class="r" style="--w:${r.share[1]}%"><span>${r.share[1]}%</span></div></div><div class="db-line soft">${pl(r.total, 'vote')} · ${r.called} called it</div>`;
      return `${head}${bars}`;
    }
    return '';
  }
  function resultTable(s) {
    const r = s.result; if (!r) return '';
    const best = r.best && r.best.length ? `<div class="db-bestline">🏅 <b>Best line:</b> ${r.best.map((b) => `${av(b.who)} ${esc(b.who.name)}’s ${esc(b.label.toLowerCase())}${b.text ? ` <q>${esc(b.text)}</q>` : ''}`).join(' · ')}</div>` : '';
    const rows = r.breakdown.slice().sort((a, b) => b.total - a.total).map((x, i) => `<div class="db-brow ${SIDE_CLS[x.side]}" style="animation-delay:${0.6 + i * 0.15}s"><span class="nm">${av(x)} ${esc(x.name)}</span><span>🗳️ ${x.share}</span><span>${x.win ? `🔨 ${x.win}` : '—'}</span><span>${x.crowd ? `📣 ${x.crowd}` : '—'}</span><span>${x.best ? `🏅 ${x.best}` : '—'}</span><b>+${x.total}</b></div>`).join('');
    return `<div class="db-break"><div class="db-bhead"><span></span><span>Vote share</span><span>Win</span><span>Crowd</span><span>Best line</span><span>Total</span></div>${rows}${best}</div>`;
  }
  function board(rows, n = 8) {
    return `<div class="db-board">${rows.slice(0, n).map((r, i) => `<div class="db-brd"><span class="n">${i + 1}</span><span class="nm">${av(r)} ${esc(r.name)}</span><b>${r.points}</b></div>`).join('')}</div>`;
  }
  const awardsHtml = (aw) => `<div class="db-awards">${(aw || []).map((a, i) => `<div class="db-award a-${esc(a.k)}" style="animation-delay:${0.5 + i * 0.25}s"><div class="ic">${esc(a.icon)}</div><div class="t">${esc(a.title)}</div><div class="nm">${a.names.map(esc).join(', ')}</div><div class="tx">${esc(a.text)}</div></div>`).join('')}</div>`;
  function overTv(s) {
    const st = s.standings || [], top = [st[1], st[0], st[2]];
    return `<div class="db-over"><h1 class="db-h">🏆 The Closing Ceremony</h1>
      <div class="db-podium3">${top.map((r, i) => (r ? `<div class="db-p3 p${[2, 1, 3][i]}" style="--c:${esc(r.color)}">${has(r) ? `<div class="fig">${BOX.body(r, i === 1 ? 190 : 150, { mood: i === 1 ? 'grin' : 'smile' })}</div>` : `<div class="av">${esc(r.avatar || '🙂')}</div>`}<div class="nm">${esc(r.name)}</div><div class="pts">${r.points}</div><div class="blk">${[2, 1, 3][i]}</div></div>` : '<div></div>')).join('')}</div>
      ${awardsHtml(s.awards)}<div class="db-final-board">${board(st, 12)}</div></div>`;
  }
  // Reactions float up from the speaker's podium (a data-keep layer, fed by new reaction ids).
  let seen = -1, lastBoo = 0;
  function floats(el, s) {
    const layer = el.querySelector('.db-floats'); if (!layer || !s.reacts) return;
    if (s.reacts.length && s.reacts[s.reacts.length - 1].id < seen) seen = 0; // a new game: ids start over
    const fresh = s.reacts.filter((r) => r.id > seen);
    if (s.reacts.length) seen = Math.max(seen, s.reacts[s.reacts.length - 1].id);
    if (seen < 0 || !fresh.length || el._dbFirst) { el._dbFirst = false; return; }
    const box = layer.getBoundingClientRect();
    const count = {};
    for (const r of fresh.slice(-14)) {
      count[r.e] = (count[r.e] || 0) + 1;
      const pod = el.querySelector('#db-pod-' + r.s), pb = pod ? pod.getBoundingClientRect() : box;
      const f = document.createElement('span'); f.className = 'db-float' + (r.e === '🍅' ? ' tomato' : ''); f.textContent = r.e;
      f.style.left = (pb.left - box.left + pb.width * (0.2 + Math.random() * 0.6)) + 'px';
      f.style.top = (pb.top - box.top + pb.height * 0.45) + 'px';
      f.style.setProperty('--dx', (Math.random() * 120 - 60).toFixed(0) + 'px');
      f.style.animationDelay = (Math.random() * 0.25).toFixed(2) + 's';
      layer.appendChild(f); setTimeout(() => f.remove(), 2600);
    }
    const now = Date.now();
    if (now - lastBoo > 4500) { const big = Object.entries(count).find(([, n]) => n >= 4); if (big) { lastBoo = now; BOX.sfx(big[0] === '🍅' ? 'boo' : big[0] === '😂' ? 'laugh' : 'cheer'); } }
  }

  function tv(el, s) {
    if (!s) return;
    if (s.phase === 'over') { paint(el, overTv(s), 'over'); return; }
    if (!s.podiums) return;
    const status0 = s.phase === 'prep' ? [0, 1].map((k) => (s.podiums[k].ready ? '<div class="db-tag ok">✓ Ready</div>' : '<div class="db-tag">📝 Preparing…</div>')) : ['', ''];
    if (s.phase === 'result' && s.result && s.result.winner !== null) status0[s.result.winner] = '<div class="db-crown">🏆 WINNER</div>';
    const showMeter = ['speech', 'closer', 'swap', 'ask', 'write', 'vote'].includes(s.phase);
    const top = `<div class="db-top"><span class="db-round">DEBATE <b>${s.n}</b> OF ${s.of}</span>${kindBadge(s)}<span class="db-tright">${s.phase === 'result' ? 'Points this debate' : `👥 Crowd: ${s.crowd}`}</span></div>`;
    const html = `<div class="db-hall ph-${esc(s.phase)}">${top}${motion(s, s.phase === 'intro' ? 'drop' : '')}
      <div class="db-stagerow">${podium(s, 0, status0[0])}<div class="db-center">${center(s)}</div>${podium(s, 1, status0[1])}</div>
      ${showMeter ? meter(s) : s.phase === 'result' ? resultTable(s) : ''}
      <div class="db-floats" data-keep></div></div>`;
    const key = s.dkey + '-' + s.phase + '-' + s.stepKey;
    if (paint(el, html, key)) el._dbFirst = seen < 0;
    floats(el, s);
  }

  // ======================= PHONE =======================
  let askDraft = '', askOpen = false, closeDraft = '', closeEdit = false, askEdit = false, voteEdit = false, celebrated = '';
  const phoneHead = (v) => `<div class="db-ph-head"><span>🗣️ Debate ${v.n || '-'}/${v.of}</span>${kindBadge(v)}<span>🏅 ${v.points} · #${v.rank || '-'}</span></div>`;
  const cardSmall = (c, i) => `<button class="db-icard ph ${c.played ? 'played' : ''}" ${c.played ? 'disabled' : `data-card="${i}"`}><span class="ic">${esc(c.icon)}</span><span class="tx"><b>${esc(c.title)}</b><small>${esc(c.hint)}</small></span><em>${c.played ? '✓' : 'Play'}</em></button>`;
  const cardHtml = (c, i, playable) => `<button class="db-icard ph ${c.played ? 'played' : ''}" ${playable && !c.played ? `data-card="${i}"` : 'disabled'}><span class="ic">${esc(c.icon)}</span><b>${esc(c.title)}</b><small>${esc(c.hint)}</small>${playable ? `<em>${c.played ? 'Played ✓' : 'Tap to play on the TV'}</em>` : ''}</button>`;
  const mySide = (v) => `<div class="db-myside ${SIDE_CLS[v.side]}"><small>${v.myRole ? `You are the ${esc(v.myRole.toUpperCase())}` : 'You argue'}</small><b>${esc(v.myLabel)}</b></div>`;
  const motionSmall = (v) => `<div class="db-ph-motion">${v.topic.case ? `${esc(v.topic.case.e)} <b>${esc(v.topic.case.who)}</b> stands accused of ${esc(v.topic.case.crime)}.` : esc(v.topic.q)}</div>`;
  const timerTxt = (v) => { const e = endAt('p' + v.stepKey, v.endsIn); return e ? `<span class="timer db-t" data-ends="${e}">${BOX.mmss(e - Date.now())}</span>` : ''; };
  const reactPad = (v) => `<div class="db-pad">${REACTS.map(([k, e, lab]) => `<button class="db-rb r-${k}" data-react="${k}"><span>${e}</span><small>${lab}</small></button>`).join('')}</div>`;

  function askBox(v) {
    if (!v.canAsk) return '';
    if (v.myAsk && !askEdit) return `<div class="db-asked">❓ Your question: <b>${esc(v.myAsk)}</b> <button class="db-link" id="db-ask-edit">edit</button></div>`;
    return `<div class="db-askbox ${askOpen || v.phase === 'prep' ? 'open' : ''}">${askOpen || v.phase === 'prep' ? `<label>❓ Ask the debaters a question</label><div class="db-row"><input id="db-ask" maxlength="90" placeholder="e.g. What would your grandma say?" value="${esc(askDraft)}" autocomplete="off"><button class="btn green" id="db-ask-go">Send</button></div><small class="muted">The room votes on the questions before the Q&amp;A.</small>` : '<button class="btn ghost db-ask-open" id="db-ask-open">❓ Ask the debaters a question</button>'}</div>`;
  }
  function bindAsk(el, ctx) {
    const o = el.querySelector('#db-ask-open'); if (o) o.onclick = () => { askOpen = true; ctx.redraw(); setTimeout(() => { const i = el.querySelector('#db-ask'); if (i) i.focus(); }, 30); };
    const e = el.querySelector('#db-ask-edit'); if (e) e.onclick = () => { askEdit = true; askOpen = true; ctx.redraw(); };
    const i = el.querySelector('#db-ask'); if (i) { i.oninput = () => { askDraft = i.value; }; i.onkeydown = (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); send(); } }; }
    const g = el.querySelector('#db-ask-go');
    async function send() { const t = (i && i.value || '').trim(); if (!t) return ctx.toast && ctx.toast('Type a question first!'); const r = await ctx.act({ op: 'ask', text: t }); if (r && r.ok) { askDraft = ''; askEdit = false; askOpen = false; if (i) i.blur(); haptic(ctx, 'success'); ctx.sfx('chime'); ctx.redraw(); } }
    if (g) g.onclick = send;
  }
  function bindPad(el, ctx) {
    for (const b of el.querySelectorAll('[data-react]')) b.onclick = () => {
      haptic(ctx, 'tap'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
      ctx.act({ op: 'react', e: b.dataset.react });
    };
  }

  function phoneDebater(v, ctx) {
    const others = v.podiums[1 - v.side].members, opp = names(others);
    const cards = (playable) => (v.cards && v.cards.length ? `<div class="db-cards">${v.cards.map((c, i) => cardHtml(c, i, playable)).join('')}</div>` : '');
    if (v.phase === 'intro') return { html: `<div class="db-big-tag">🎤 You’re debating!</div>${motionSmall(v)}${mySide(v)}<p class="db-vsline">vs ${av(others[0])} <b>${opp}</b></p>${v.team ? `<p class="muted center">Your team: ${names(v.team)}</p>` : ''}<p class="muted center">${v.kind === 'hot' ? 'Twenty seconds. Get ready!' : 'Prep starts in a moment…'}</p>` };
    if (v.phase === 'prep') {
      return { html: `${motionSmall(v)}${mySide(v)}<div class="db-sub">🃏 Your argument cards <span class="muted">(play them during your speech)</span></div>${cards(false)}
        ${v.ready ? '<div class="db-ready">✓ Ready! Waiting for the others… ' + timerTxt(v) + '</div>' : `<button class="btn big green db-go" id="db-done">I’m ready ✓</button><p class="muted center">Prep ends in ${timerTxt(v)}</p>`}`,
      bind: (el) => { const d = el.querySelector('#db-done'); if (d) d.onclick = async () => { const r = await ctx.act({ op: 'done' }); if (r.ok) { haptic(ctx, 'success'); ctx.redraw(); } }; } };
    }
    if (v.phase === 'swap') return { html: `<div class="db-swap ph">🔄 SWAP!</div>${mySide(v)}<p class="center">Now argue the <b>other side</b>. Same passion!</p>` };
    if ((v.phase === 'speech' || v.phase === 'closer') && v.isSpeaker) {
      const q = v.stage === 'answer' && v.question ? `<div class="db-qcard ph"><small>❓ ${v.question.by ? esc(v.question.by) + ' asks' : 'The moderator asks'}</small>${esc(v.question.text)}</div>` : '';
      const line = v.phase === 'closer' ? `<div class="db-quote ph ${SIDE_CLS[v.side]}">${v.myCloser ? `“${esc(v.myCloser)}”` : '<i>No line written: say it from the heart!</i>'}</div><p class="center">Read it out loud, with feeling! 🎭</p>` : '';
      const playable = v.phase === 'speech' && v.cards && v.cards.length;
      return { html: `<div class="db-onair ${SIDE_CLS[v.side]}"><div class="lab">🔴 YOU’RE ON!</div><div class="st">${esc(v.stageLabel || '')}</div>${timerTxt(v)}<div class="side">${v.myRole ? esc(v.myRole) + ' · ' : ''}${esc(v.myLabel)}</div></div>${q}${line}
        ${playable ? `<div class="db-sub">🃏 Play a card <span class="muted">(it pops up on the TV)</span></div><div class="db-cards compact">${v.cards.map((c, i) => cardSmall(c, i)).join('')}</div>` : ''}<button class="btn big db-go db-pass" id="db-done">I’m done ✓ <small>pass the mic</small></button>`,
      bind: (el) => {
        const d = el.querySelector('#db-done'); if (d) d.onclick = async () => { const r = await ctx.act({ op: 'done' }); if (r.ok) { haptic(ctx, 'success'); } };
        for (const b of el.querySelectorAll('[data-card]')) b.onclick = async () => { const r = await ctx.act({ op: 'card', i: Number(b.dataset.card) }); if (r.ok) { haptic(ctx, 'select'); ctx.sfx('flip'); ctx.redraw(); } };
      } };
    }
    if (v.phase === 'speech' || v.phase === 'closer') {
      const sp = v.speaker || {}, mate = v.team && v.team.some((m) => m.id === sp.id);
      return { html: `<div class="db-listen"><div class="av">${av(sp, 76)}</div><b>${esc(sp.name)}</b> ${mate ? 'is speaking for your team!' : 'is speaking…'}<div class="st">${esc(v.stageLabel || '')} · ${timerTxt(v)}</div></div>${mySide(v)}<p class="muted center">${mate ? 'Back them up with your best poker face.' : 'Listen closely: your turn is coming.'}</p>${v.cards ? `<div class="db-sub">🃏 Your cards</div>${cards(false)}` : ''}` };
    }
    if (v.phase === 'ask') return { html: `${mySide(v)}<div class="db-wait">❓ The audience is picking your question…</div>${v.question ? `<div class="db-qcard ph"><small>The question</small>${esc(v.question.text)}</div>` : ''}` };
    if (v.phase === 'write') {
      if (!v.isWriter) return { html: `${mySide(v)}<div class="db-wait">✍️ ${esc(v.writer ? v.writer.name : 'Your teammate')} is writing your team’s closing line…</div>` };
      if (v.myCloser && !closeEdit) return { html: `${mySide(v)}<div class="db-quote ph ${SIDE_CLS[v.side]}">“${esc(v.myCloser)}”</div><p class="center">Locked in! You’ll read it out next. <button class="db-link" id="db-cedit">edit</button></p><p class="muted center">${timerTxt(v)}</p>`, bind: (el) => { el.querySelector('#db-cedit').onclick = () => { closeEdit = true; closeDraft = v.myCloser; ctx.redraw(); }; } };
      return { html: `${mySide(v)}<div class="db-sub">✍️ Write your closing line</div><p class="muted">One killer sentence. It goes up on the TV and you read it out loud.</p><textarea id="db-close" maxlength="90" rows="3" placeholder="e.g. Soup is not a meal. Soup is a lifestyle.">${esc(closeDraft)}</textarea><button class="btn big green db-go" id="db-close-go">🎤 Lock it in</button><p class="muted center">${timerTxt(v)}</p>`,
        bind: (el) => {
          const t = el.querySelector('#db-close'); t.oninput = () => { closeDraft = t.value; };
          el.querySelector('#db-close-go').onclick = async () => { const r = await ctx.act({ op: 'closer', text: t.value }); if (r.ok) { closeEdit = false; t.blur(); haptic(ctx, 'success'); ctx.sfx('chime'); ctx.redraw(); } };
        } };
    }
    if (v.phase === 'vote') return { html: `${mySide(v)}<div class="db-wait">🗳️ The crowd is voting… fingers crossed!</div>` };
    return null;
  }

  function phoneAudience(v, ctx) {
    const P = v.podiums;
    const vsLine = `<div class="db-vsmini"><span class="blue">${av(P[0].members[0])} ${names(P[0].members)}<small>${esc(P[0].label)}</small></span><b>VS</b><span class="red">${av(P[1].members[0])} ${names(P[1].members)}<small>${esc(P[1].label)}</small></span></div>`;
    if (v.phase === 'intro') return { html: `${motionSmall(v)}${vsLine}<div class="db-wait">👀 You’re in the audience. Get ready to react!</div>` };
    if (v.phase === 'prep') return { html: `${motionSmall(v)}${vsLine}${askBox(v)}<p class="muted center">The debaters are preparing… ${timerTxt(v)}</p>`, bind: (el) => bindAsk(el, ctx) };
    if (v.phase === 'speech' || v.phase === 'closer' || v.phase === 'swap') {
      const k = v.speakSide, sp = v.speaker;
      const who = v.phase === 'swap' ? '<div class="db-swap ph">🔄 SWAP SIDES!</div>' : `<div class="db-now ${SIDE_CLS[k]}">${av(sp)} <b>${esc(sp ? sp.name : '')}</b> · ${esc(P[k].label)} <span class="muted">${esc(v.stageLabel || '')}</span> ${timerTxt(v)}</div>`;
      return { html: `${who}${v.phase === 'swap' ? '' : reactPad(v)}${askBox(v)}`, bind: (el) => { bindPad(el, ctx); bindAsk(el, ctx); } };
    }
    if (v.phase === 'ask') {
      if (!v.choices) return { html: `<div class="db-qcard ph"><small>❓ The moderator asks</small>${esc(v.question ? v.question.text : '')}</div>` };
      return { html: `<div class="db-sub">❓ Which question should they answer? ${timerTxt(v)}</div><div class="db-qlist">${v.choices.map((q, i) => `<button class="db-qbtn ${v.myQ === i ? 'sel' : ''}" data-q="${i}"><b>${'ABCD'[i]}</b><span>${esc(q.text)}</span>${q.mine ? '<small>yours</small>' : ''}</button>`).join('')}</div>`,
        bind: (el) => { for (const b of el.querySelectorAll('[data-q]')) b.onclick = async () => { const r = await ctx.act({ op: 'qvote', i: Number(b.dataset.q) }); if (r.ok) { haptic(ctx, 'select'); ctx.redraw(); } }; } };
    }
    if (v.phase === 'write') return { html: `${vsLine}<div class="db-wait">✍️ The debaters are writing their closing lines… get your reactions ready! ${timerTxt(v)}</div>` };
    if (v.phase === 'vote') {
      const sideBtns = `<div class="db-votes">${[0, 1].map((k) => `<button class="db-vbtn ${SIDE_CLS[k]} ${v.myVote === k ? 'sel' : ''}" data-side="${k}"><span class="av">${av(P[k].members[0], 72)}</span><b>${names(P[k].members)}</b><small>${esc(P[k].label)}</small>${v.myVote === k ? '<em>✓</em>' : ''}</button>`).join('')}</div>`;
      const needBest = v.kind !== 'hot' && v.segs && v.segs.length;
      if (v.myVote === null || voteEdit || !needBest) {
        return { html: `<div class="db-sub">🗳️ Who won the debate? ${timerTxt(v)}</div>${sideBtns}${v.myVote !== null && !needBest ? '<div class="db-ready">✓ Vote cast! You can still change it.</div>' : ''}`,
          bind: (el) => { for (const b of el.querySelectorAll('[data-side]')) b.onclick = async () => { const r = await ctx.act({ op: 'vote', side: Number(b.dataset.side) }); if (r.ok) { voteEdit = false; haptic(ctx, 'success'); ctx.sfx('ballot'); ctx.redraw(); } }; } };
      }
      const segs = v.segs.map((g) => `<button class="db-seg ${SIDE_CLS[g.side]} ${v.myBest === g.i ? 'sel' : ''}" data-best="${g.i}"><span class="who">${av(g.who)} ${esc(g.who.name)}</span><span class="lab">${esc(g.label)}</span>${g.text ? `<q>${esc(g.text)}</q>` : ''}${v.myBest === g.i ? '<em>✓</em>' : ''}</button>`).join('');
      return { html: `<div class="db-voted ${SIDE_CLS[v.myVote]}">✓ You voted for <b>${names(P[v.myVote].members)}</b> <button class="db-link" id="db-vedit">change</button></div><div class="db-sub">🏅 Which speech had the best line? ${timerTxt(v)}</div><div class="db-segs">${segs}</div>`,
        bind: (el) => {
          el.querySelector('#db-vedit').onclick = () => { voteEdit = true; ctx.redraw(); };
          for (const b of el.querySelectorAll('[data-best]')) b.onclick = async () => { const r = await ctx.act({ op: 'best', i: Number(b.dataset.best) }); if (r.ok) { haptic(ctx, 'select'); ctx.redraw(); } };
        } };
    }
    return null;
  }

  function phoneResult(v, ctx) {
    const r = v.result; if (!r) return `<div class="db-wait">The gavel is coming down…</div>`;
    const P = v.podiums, w = r.winner, lines = [];
    lines.push(w === null ? '<div class="db-res-head">⚖️ A dead heat!</div>' : `<div class="db-res-head ${SIDE_CLS[w]}">🔨 ${v.kind === 'lawyer' ? (w === 0 ? 'NOT GUILTY!' : 'GUILTY!') : `${names(P[w].members)} ${P[w].members.length > 1 ? 'win' : 'wins'}!`}</div>`);
    lines.push(`<div class="db-res-split"><span class="blue">${r.share[0]}%</span><span class="red">${r.share[1]}%</span></div>`);
    if (r.row) {
      const x = r.row;
      lines.push(`<div class="db-res-rows"><div>🗳️ Vote share <b>+${x.share}</b></div>${x.win ? `<div>🔨 The win <b>+${x.win}</b></div>` : ''}${x.crowd ? `<div>📣 Crowd meter <b>+${x.crowd}</b></div>` : ''}${x.best ? `<div>🏅 Best line <b>+${x.best}</b></div>` : ''}</div>`);
    } else if (v.myVote != null) lines.push(w === null ? '<p class="center">A tie: no winner to call.</p>' : v.myVote === w ? '<p class="center db-good">🔮 You backed the winner!</p>' : '<p class="center muted">The room disagreed with you this time 🙃</p>');
    if (r.best && r.best.length && r.best.some((b) => b.i === v.myBest)) lines.push('<p class="center db-good">🏅 You picked the best line!</p>');
    lines.push(`<div class="db-total">${v.gained ? `+${v.gained} points` : 'No points this time'}</div>`);
    const k = v.dkey + ':' + v.mini;
    if (celebrated !== k) { celebrated = k; if (r.row && w === r.row.side) { haptic(ctx, 'win'); ctx.sfx('win'); } else if (v.gained) haptic(ctx, 'success'); else haptic(ctx, 'warn'); }
    return lines.join('');
  }

  function phone(el, v, ctx) {
    // JustGold gear: this game's phone theme, a frame and badge over your screen (public/shared/gear.js).
    if (window.MT_GEAR) window.MT_GEAR.phoneTheme(el, arguments[3], 'debate');
    if (!v) return;
    if (v.phase === 'over') {
      feel(ctx, 'over', 1, v.rank === 1 ? 'win' : 'success');
      const mine = (v.awards || []).filter((a) => a.names.includes((v.standings.find((r) => r.id === v.me) || {}).name));
      paint(el, `<div class="db-ph"><div class="card-box center"><div class="db-place">${v.rank === 1 ? '🏆' : v.rank === 2 ? '🥈' : v.rank === 3 ? '🥉' : '🎤'}</div><h3>You finished #${v.rank} of ${v.ofPlayers}</h3><p>${v.points} points</p>${mine.length ? `<p>Your awards: ${mine.map((a) => `${esc(a.icon)} <b>${esc(a.title)}</b>`).join(', ')}</p>` : ''}</div>${awardsHtml(v.awards)}<div class="card-box">${board(v.standings, 10)}</div></div>`, 'over');
      return;
    }
    if (felt.over) felt = {};
    if (!v.podiums) { paint(el, '<div class="db-ph"><div class="db-wait">The house is coming to order…</div></div>', 'wait'); return; }
    const sk = v.dkey + ':' + v.stepKey;
    if (v.role === 'debater') {
      if (v.phase === 'intro') feel(ctx, 'intro', v.dkey, 'big');
      if (v.isSpeaker) feel(ctx, 'turn', sk, 'turn');
      if (v.phase === 'swap') feel(ctx, 'swap', v.dkey, 'big');
    } else if (v.phase === 'vote') feel(ctx, 'vote', v.dkey, 'buzz');
    if (v.phase !== 'vote') voteEdit = false;
    if (v.phase !== 'write') { closeEdit = false; if (v.phase === 'intro') closeDraft = ''; }
    if (!v.canAsk) { askOpen = false; askEdit = false; }
    let out = null;
    if (v.phase === 'result') out = { html: phoneResult(v, ctx) };
    else out = v.role === 'debater' ? phoneDebater(v, ctx) : phoneAudience(v, ctx);
    if (!out) out = { html: '<div class="db-wait">Eyes on the big screen!</div>' };
    paint(el, `<div class="db-ph role-${esc(v.role || 'x')}">${phoneHead(v)}${out.html}</div>`, sk);
    if (out.bind) out.bind(el);
  }

  // ======================= LOBBY: the Debate Hall =======================
  // The settings are the club's ORDER PAPER (a chalkboard of motions); the join card is the
  // membership card; players take their seats in the gallery. Real <select>s stay in #settings.
  const ORDER = {
    debates: { lab: 'Debates tonight', opts: { 2: '2 · quick', 3: '3 · standard', 4: '4 · marathon' } },
    speech: { lab: 'Speech length', opts: { short: '⏱ Short', normal: '🎤 Standard', long: '📜 Long' } },
    twists: { lab: 'Twists', opts: { mix: '🔄 Swap · ⚖️ Lawyer · 🌶️ Hot takes', off: '🎓 Classic only' } },
    pack: { lab: 'Topics', opts: { auto: '🎲 Mixed', family: '🧸 Family', party: '🎉 Party' } },
    showIntro: { lab: 'Opening ceremony', opts: { true: '🔨 On', false: '⏩ Skip' } },
  };
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  function lobbyTv(el, L) {
    el.__L = L;
    if (!el.__dbl) {
      el.__dbl = true;
      el.innerHTML = `<div class="dbl">
        <header class="dbl-sign"><span class="g">🔨</span><div><small>★ THE HONOURABLE SOCIETY OF ★</small><b>Debate Club</b></div><span class="g r">🔨</span></header>
        <section class="dbl-order"><div class="dbl-oh"><b>ORDER PAPER</b><span>tap a motion to change it</span></div><div id="dbl-lines"></div><div id="settings" class="dbl-sr"></div></section>
        <aside class="dbl-card"><div class="dbl-ct"><small>MEMBERSHIP CARD</small>Join on your phone</div><img id="qr" alt="QR code to join"><div class="dbl-url" id="dbl-url"></div>
          <div class="dbl-codecap">ROOM CODE</div><div class="dbl-code" id="code"></div><div class="dbl-vip" id="dbl-vip"></div><div class="err" id="lobby-err"></div>
          <button class="dbl-start" id="start">🔨 Call the house to order</button>
          <div class="dbl-links"><button id="add-bots">+ 5 test bots</button><button id="rm-bots">remove bots</button><button id="dbl-pick">🎮 Other game</button></div></aside>
        <section class="dbl-gallery"><div class="dbl-count" id="dbl-count"></div><div class="dbl-benches" id="roster"></div></section>
        <div class="dbl-party" id="dbl-party"></div></div>`;
      const $ = (s) => el.querySelector(s);
      $('#start').onclick = async () => { const r = await el.__L.start(); $('#lobby-err').textContent = r && r.ok ? '' : (r && r.error) || ''; };
      $('#add-bots').onclick = () => el.__L.bots(5);
      $('#rm-bots').onclick = () => el.__L.removeBots();
      $('#dbl-pick').onclick = () => el.__L.pick();
      el.addEventListener('click', (e) => {
        const k = e.target.closest('[data-k]');
        if (k) {
          for (const b of k.parentNode.querySelectorAll('.dbl-opt')) b.classList.toggle('on', b === k);
          const s = el.querySelector(`select[data-set="${k.dataset.k}"]`); if (s) s.value = k.dataset.v;
          el.__L.set(k.dataset.k, k.dataset.v); BOX.sfx('gavel'); return;
        }
        const c = e.target.closest('[data-kick]');
        if (c && confirm('Remove this member?')) el.__L.kick(c.dataset.kick);
      });
    }
    const $ = (s) => el.querySelector(s);
    if ($('#code').textContent !== L.code) $('#code').textContent = L.code;
    if ($('#qr').dataset.u !== L.joinUrl) { $('#qr').src = L.qr; $('#qr').dataset.u = L.joinUrl; }
    $('#dbl-url').textContent = L.joinUrl.replace(/^https?:\/\//, '');
    const n = L.players.length;
    $('#start').disabled = n < L.min;
    $('#dbl-vip').innerHTML = L.vip ? `👑 <b>${esc(L.vip)}</b> chairs the meeting (can start from their phone)` : n < L.min ? `${L.min - n} more member${L.min - n === 1 ? '' : 's'} needed for a quorum…` : 'The first to arrive chairs the meeting 👑';
    BOX.morph($('#dbl-count'), `<b>${n}</b> member${n === 1 ? '' : 's'} in the gallery${n >= 4 && n <= 14 ? ' · <span class="ok">perfect crowd ✓</span>' : n > 14 ? ' · a full house!' : ''}`);
    const html = L.fields.map((f, i) => {
      const O = ORDER[f.key] || { lab: f.label, opts: {} }, cur = String(L.settings[f.key]);
      return `<div class="dbl-line"><span class="dbl-num">${ROMAN[i] || i + 1}.</span><div class="dbl-lab">${esc(O.lab)}</div>
        <div class="dbl-opts">${f.options.map((o) => `<button class="dbl-opt ${String(o.value) === cur ? 'on' : ''}" data-k="${esc(f.key)}" data-v="${esc(String(o.value))}" title="${esc(o.label)}">${esc(O.opts[String(o.value)] || o.label)}</button>`).join('')}</div></div>`;
    }).join('');
    const lines = $('#dbl-lines'); if (lines.__h !== html) { lines.__h = html; BOX.morph(lines, html); }
    const box = $('#settings'), sig = L.fields.map((f) => f.key + ':' + f.options.map((o) => o.value).join('|')).join(';');
    if (box.__sig !== sig) { box.__sig = sig; box.innerHTML = L.fields.map((f) => `<label>${esc(f.label)}<select data-set="${esc(f.key)}">${f.options.map((o) => `<option value="${esc(String(o.value))}">${esc(o.label)}</option>`).join('')}</select></label>`).join(''); }
    for (const s of box.querySelectorAll('select[data-set]')) {
      if (document.activeElement !== s) s.value = String(L.settings[s.dataset.set]);
      s.onchange = () => { s.blur(); el.__L.set(s.dataset.set, s.value); };
    }
    const r = $('#roster');
    r.classList.toggle('many', n > 16);
    const rh = n ? L.players.map((p, i) => `<span class="chip ${p.online ? '' : 'off'} ${p.name === L.vip ? 'vip' : ''}" data-kick="${esc(p.id)}" title="Click to remove" style="--c:${esc(p.color || '#3f8cff')};--d:${((i * 0.29) % 2.6).toFixed(2)}s"><span class="hd ${has(p) ? 'has-face' : ''}">${has(p) ? av(p, 64, { fill: true, cls: 'db-hf' }) : esc(p.avatar || '🙂')}</span><b>${esc(p.name)}</b></span>`).join('')
      : '<div class="dbl-empty">The gallery is empty. Scan the code to take a seat! 🪑</div>';
    if (r.__h !== rh) { r.__h = rh; BOX.morph(r, rh); }
    const lp = $('#dbl-party'), lh = L.lineupHtml || ''; if (lp.__h !== lh) { lp.__h = lh; lp.innerHTML = lh; }
  }

  BOX.games.debate = {
    name: 'Debate Club', icon: '🗣️', lobbyTv,
    about: 'Is cereal a soup? Two debaters get a silly topic and a side, everyone else heckles with 👏 😂 🤔 🍅 and votes for the winner.',
    how: [
      'Each debate, two players step up to the podiums with a silly topic and a side (“Is cereal a soup? You say YES.”).',
      'Debaters: 30 seconds of prep with 3 argument cards, then an opening statement, a rebuttal, one question from the audience and a typed closing line. Tap a card during your speech to show it on the TV.',
      'Audience: react live with 👏 😂 🤔 🍅 (tomatoes pull the crowd meter down), send in a question, then vote for the winner and pick the best line.',
      'Debaters score their vote share (up to 1000), +200 for the win, up to +300 from the crowd meter and +250 for the best line. The audience scores for backing the winner (+100), picking the best line (+50) and asking the chosen question (+100).',
      'Twists: 🔄 Swap Sides mid-debate, ⚖️ Lawyer Mode (defend an object accused of a crime), 🌶️ Hot Takes (20-second rounds) and 👥 Team Debates in big rooms.',
    ],
    // Soundtrack cue per phase (public/box/scores/debate.js). Speeches get a quiet bed so voices win.
    music: (s) => ({ intro: 'think', prep: 'think', speech: 'speech', closer: 'speech', swap: 'action', ask: 'think', write: 'think', vote: 'think', result: 'reveal', over: 'finale' }[s.phase] || 'play'),
    fx: { debate: 'gavel', court: 'gavel', team: 'swell', hot: 'sting', round: 'whoosh', mic: 'click', closer: 'swell', pass: 'pop', card: 'flip', swap: 'whoosh', ask: 'chime', write: 'ballot', vote: 'ballot', gavel: 'gavel', tie: 'shrug', win: 'win' },
    tv,
    phone,
  };
})();
