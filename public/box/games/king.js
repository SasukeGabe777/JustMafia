'use strict';
// Kill the King (TRIAL): TV and phone screens. The TV is a storybook castle: outside, the walls and
// the goblin horde during missions; inside, the throne room with the King on the throne, the social
// ladder down the right, and the court's set pieces (secret-message lines between portraits, the
// judgement, the coup). Sir Bellow the herald (drawn with the intro's own character,
// BOX.intros.king.host) announces every phase. Phones: your role card (tap to show / hide the
// secret role), one mission at a time, the inbox, votes, deals, the coup button, and the trial
// feedback at the end. Long-press never selects text (box.css #game).
(function () {
  const { esc, timer } = BOX;
  const clip = (f, o) => { try { return !!(window.BOX && BOX.audio && BOX.audio.clip && BOX.audio.clip('king/' + f, o)); } catch { return false; } };
  const fc = (x, n = 40, o) => (x && BOX.face ? BOX.face(x, n, { cls: 'kk-fc', ...(o || {}) }) : `<span class="kk-emo">${esc((x && x.avatar) || '🙂')}</span>`);
  const fig = (x, h = 200) => (x && BOX.body && BOX.hasLook && BOX.hasLook(x) ? BOX.body(x, h) : `<span class="kk-emo huge">${esc((x && x.avatar) || '🙂')}</span>`);
  const RUNES = ['☀️', '🌙', '⭐', '👑', '🗝️', '🐟'], RUNE_NAMES = ['Sun', 'Moon', 'Star', 'Crown', 'Key', 'Fish'];
  const SECRET_ICON = { assassin: '🗡️', spy: '👁️', ghoul: '💀', seer: '🔮', turncloak: '👺', loyal: '🕊️' };
  const SECRET_NAME = { assassin: 'Assassin', spy: 'Spy', ghoul: 'Ghoul', seer: 'Fortune Teller', turncloak: 'Turncloak', loyal: 'Loyal Subject' };
  const SENT = { kill: { icon: '💀', name: 'KILL', verb: 'be killed' }, demote: { icon: '⬇️', name: 'DEMOTE', verb: 'drop to the bottom' }, reveal: { icon: '📜', name: 'REVEAL', verb: 'have their messages read out' } };
  const PHASE_NAME = { brief: 'To your posts', mission: 'Mission', repel: 'The wave', court: 'Court', dusk: 'Dusk', coup: 'COUP!', coupResult: 'The coup', trial: 'The old King', trialResult: 'The old King', summon: 'Judgement', hearing: 'Judgement', verdict: 'Verdict', pay: 'Payday', siege: 'The siege', unmask: 'Unmasked', over: 'The end' };
  // Round-1 teaching: what each phase is, shown big on the TV and as a tip on the phones.
  const TEACH = {
    brief: 'Every round starts with a MISSION. Work together: the kingdom needs enough DEFENCE by the end of the game.',
    mission: 'Do the task on your phone! Every success adds defence. Ghosts count half.',
    repel: 'Beat the wave and the walls hold. Fall short and they dent. Only the TOTAL at the end decides if the kingdom falls.',
    court: 'Now scheme! Send secret messages (the TV only shows who talks to whom). Anyone can press COUP to grab the throne.',
    dusk: 'At dusk the Assassin may strike. A miss leaves a clue about who they are.',
    coup: 'A COUP needs YES from 60% of everyone alive. Win and you are King; lose and you drop to the bottom.',
    trial: 'The old King: SPARE them (they drop to the bottom) or KILL them (they become a ghost).',
    summon: 'The King summons one player for a sentence: KILL, DEMOTE or REVEAL their messages.',
    hearing: 'Everyone votes AYE or NAY. The King can promise you a promotion; the accused can pay you. Deals are binding!',
    verdict: 'Deals are paid automatically. Break an oath and you pay a fine to the one you betrayed.',
    pay: 'Rank pays every round: Crown 100, Nobles 60, Guild 35, Commons 15, plus a mission bonus. Ghosts get no rank pay.',
  };
  const isRoom = (ph) => !['brief', 'mission', 'repel', 'siege'].includes(ph);

  // ---------------- people ----------------
  function people(s) {
    const m = new Map();
    for (const x of [...(s.standings || []), ...(s.ghosts || []).map((g) => ({ ...g, ghost: true })), ...(s.ladder || [])]) m.set(x.id, { ...(m.get(x.id) || {}), ...x });
    if (s.people) for (const x of s.people) m.set(x.id, { ...(m.get(x.id) || {}), ...x });
    return m;
  }
  const who = (s, id) => (s._pp || (s._pp = people(s))).get(id) || { id, name: '—', avatar: '👻' };
  const nm = (s, id) => esc(BOX.filterText ? BOX.filterText(who(s, id).name) : who(s, id).name);

  // ================================================================= PHONE
  const PH = { el: null, v: null, ctx: null, tab: 'main', peek: false, to: new Set(), draft: '', last: '', seenMsgs: 0, gold: 25, fbNote: '', fbOpen: false, tips: new Set() };
  const rer = () => { if (PH.el && PH.v) phone(PH.el, PH.v, PH.ctx, true); };
  const head = (v) => {
    const me = v.mine || {}, t = me.title;
    return `<div class="kk-bar"><span class="kk-r">${v.round ? `Round ${v.round}/${v.of}` : 'Kill the King'}</span><span class="kk-trial">TRIAL</span>
      ${v.endsIn && !['over'].includes(v.phase) ? `<span class="kk-t">${timer(v.endsIn)}</span>` : '<span></span>'}<b>⭐ ${me.points || 0}</b></div>
      <div class="kk-me ${me.ghost ? 'ghost' : ''}">${me.ghost ? '👻 <b>Ghost</b><small>no rank, half-strength missions</small>' : t ? `${esc(t.icon)} <b>${esc(t.name)}</b><small>${esc(me.tier.name)} · ${me.tier.pay}/round</small>` : ''}</div>`;
  };
  function roleCard(v) {
    const sc = (v.mine || {}).secret || {};
    return `<div class="kk-role ${PH.peek ? 'open' : ''}" id="kk-peek"><div class="kk-role-h">🎭 YOUR SECRET ROLE <small>${PH.peek ? 'tap to hide' : 'tap to show'}</small></div>
      ${PH.peek ? `<div class="kk-role-b"><span class="kk-role-i">${esc(sc.icon || '')}</span><div><b>${esc(sc.name || '')}</b><p>${esc(sc.blurb || '')}</p></div></div>` : '<div class="kk-role-b hid">🔒 Hidden. Keep it from the people around you!</div>'}</div>`;
  }
  function tip(v) {
    if (!v.tutor || !TEACH[v.phase]) return '';
    const k = v.round + ':' + v.phase; if (PH.tips.has(k)) return '';
    return `<div class="kk-tip" data-tip="${esc(k)}"><span>📜</span><p>${esc(TEACH[v.phase])}</p><button class="kk-x" data-tipx="${esc(k)}">Got it</button></div>`;
  }
  const unread = (v) => Math.max(0, (v.inbox || []).filter((m) => !m.mine).length - PH.seenMsgs);
  function tabs(v) {
    if (!v.canMsg || ['siege', 'unmask', 'over'].includes(v.phase)) return '';
    const u = PH.tab === 'inbox' ? 0 : unread(v);
    return `<div class="kk-tabs"><button class="${PH.tab === 'main' ? 'on' : ''}" data-tab="main">🏰 ${esc(PHASE_NAME[v.phase] || 'Court')}</button><button class="${PH.tab === 'inbox' ? 'on' : ''}" data-tab="inbox">💌 Messages${u ? ` <i>${u}</i>` : ''}</button></div>`;
  }
  const pick = (s, list, sel, attr, o = {}) => `<div class="kk-picks">${list.map((x) => `<button class="kk-pk ${sel && sel(x) ? 'sel' : ''} ${x.ghost ? 'ghost' : ''}" ${attr}="${esc(x.id)}" ${o.dis && o.dis(x) ? 'disabled' : ''}>${fc(x, 34)}<b>${esc(x.name)}</b>${o.sub ? `<small>${o.sub(x)}</small>` : ''}</button>`).join('')}</div>`;
  const seatName = (v, id) => { const L = v.ladder || []; const r = L.find((x) => x.id === id); return r ? `${esc(r.icon)} ${esc(r.title)}` : '👻 ghost'; };

  function inbox(v) {
    const s = v, ppl = (v.people || []);
    const chips = ppl.map((x) => `<button class="kk-to ${PH.to.has(x.id) ? 'on' : ''}" data-to="${esc(x.id)}">${fc(x, 26)}${esc(x.name)}</button>`).join('');
    const list = (v.inbox || []).slice().reverse().map((m) => {
      const from = who(s, m.from), to = m.to.map((id) => (id === v.me ? 'you' : esc(who(s, id).name))).join(', ');
      return `<div class="kk-msg ${m.mine ? 'mine' : ''}">${m.mine ? '' : fc(from, 30)}<div><small>${m.mine ? `You → ${to}` : `${esc(from.name)} → ${to}`} · R${m.round}</small><p>${esc(m.text)}</p></div>${m.mine ? '' : `<button class="kk-re" data-re="${esc([m.from, ...m.to.filter((id) => id !== v.me)].join(','))}">↩</button>`}</div>`;
    }).join('') || '<p class="kk-mut">No messages yet. Whisper to someone!</p>';
    const can = v.canMsg;
    return `<div class="kk-card"><div class="kk-h">💌 Secret message <small>to 1–3 people</small></div><div class="kk-tos">${chips}</div>
      <div class="kk-pre">${(v.presets || []).map((p, i) => `<button data-pre="${i}">${esc(p)}</button>`).join('')}</div>
      <div class="kk-in"><input id="kk-text" maxlength="100" autocomplete="off" placeholder="${can ? 'Or write your own…' : 'Messages open after the mission'}" value="${esc(PH.draft)}" ${can ? '' : 'disabled'}><button class="kk-btn go" id="kk-send" ${can && PH.to.size ? '' : 'disabled'}>Send</button></div></div>
      <div class="kk-inbox">${list}</div>`;
  }

  function mission(v) {
    const T = v.task; if (!T) return '<div class="kk-card"><h2>🛡️ Defend!</h2><p>Watch the walls on the TV.</p></div>';
    const M = v.mission || {}, half = T.eff < 1 ? `<div class="kk-half">${v.mine.ghost ? '👻 Ghost: half strength' : '😱 Haunted: half strength'}</div>` : '';
    let body = '';
    if (T.key === 'wall') body = `<p class="kk-ins">Tap the <b>cracked</b> stones!</p><div class="kk-wall ${T.lockIn ? 'lock' : ''}">${Array.from({ length: 9 }, (_, i) => `<button class="kk-stone ${T.cracks.includes(i) ? 'crack' : ''}" data-cell="${i}"></button>`).join('')}</div>`;
    else if (T.key === 'beacons') body = `<div class="kk-myrune"><small>YOUR RUNE: shout it!</small><b>${RUNES[T.rune]}</b><span>${RUNE_NAMES[T.rune]}</span></div>
      <p class="kk-ins">${T.ask ? `What is <b>${esc(T.ask.name)}</b>’s rune?${T.askBot ? ' <small>(bots shout on the TV)</small>' : ''}` : 'Waiting for someone to ask…'}</p>
      <div class="kk-runes ${T.lockIn ? 'lock' : ''}">${RUNES.map((r, i) => `<button data-rune="${i}"><b>${r}</b><small>${RUNE_NAMES[i]}</small></button>`).join('')}</div>${T.lockIn ? '<p class="kk-smoke">💨 Smoke! Wait…</p>' : ''}`;
    else if (T.key === 'bells') body = `<p class="kk-ins">Ring <b>together</b>! Count it in out loud.</p><button class="kk-bell ${T.coolIn ? 'cool' : ''}" id="kk-bell">🔔<small>${T.coolIn ? 'swinging…' : 'RING'}</small></button>`;
    else if (T.key === 'gate') body = `<p class="kk-ins">${T.mates.length ? `Hold with ${T.mates.map((m) => `<b>${esc(m.name)}</b> ${m.hold ? '✊' : '✋'}`).join(' & ')}` : 'Hold the winch!'}</p>
      <button class="kk-grip ${T.hold ? 'on' : ''} ${T.turning ? 'turn' : ''} ${T.slipIn ? 'slip' : ''}" id="kk-grip">${T.slipIn ? '😖<small>Slipped! Re-grip</small>' : T.turning ? '⚙️<small>TURNING!</small>' : T.hold ? '✊<small>Holding… wait for your partner</small>' : '🚪<small>HOLD</small>'}</button>`;
    return `<div class="kk-card mis"><div class="kk-h">${esc(M.icon || '')} ${esc(M.name || '')}<small>+${T.units} defence</small></div>${half}${body}</div>`;
  }

  function powers(v) {
    const out = [], s = v, alive = (v.ladder || []).filter((x) => x.id !== v.me);
    if (v.assassin && v.phase === 'court') {
      const A = v.assassin;
      out.push(A.ready ? `<div class="kk-card pw"><div class="kk-h">🗡️ Assassin <small>${Math.round(A.odds * 100)}% chance, every other round</small></div><p>${A.target ? `Marked: <b>${nm(s, A.target)}</b>. They may die at dusk.` : 'Mark a target (tap again to change):'}</p>${pick(s, alive, (x) => x.id === A.target, 'data-mark', { sub: (x) => `${esc(x.icon)} ${esc(x.title)}` })}${A.target ? '<button class="kk-link" id="kk-unmark">Put the dagger away</button>' : ''}</div>`
        : `<div class="kk-card pw dim">🗡️ Your dagger rests. Next chance: round ${A.next}.</div>`);
    }
    if (v.spy && !['siege', 'unmask', 'over', 'mission'].includes(v.phase)) {
      const S = v.spy;
      out.push(`<div class="kk-card pw"><div class="kk-h">👁️ Spy glass <small>one player a round</small></div>${S.target ? `<p>Watching <b>${nm(s, S.target)}</b>: what they SEND this round.</p><div class="kk-spied">${S.msgs.map((m) => `<p>“${esc(m.text)}” <small>→ ???</small></p>`).join('') || '<p class="kk-mut">Nothing sent yet…</p>'}</div>` : `<p>Pick someone to watch this round:</p>${pick(s, v.people || [], null, 'data-spy')}`}</div>`);
    }
    if (v.seer && !['siege', 'unmask', 'over', 'mission'].includes(v.phase)) {
      const S = v.seer;
      out.push(S.peek ? `<div class="kk-card pw dim">🔮 You saw: <b>${esc(S.peek.name)}</b> is the <b>${esc(S.peek.icon)} ${esc(S.peek.name2)}</b>.</div>` : `<div class="kk-card pw"><div class="kk-h">🔮 Crystal ball <small>once a game</small></div><p>Peek at one player’s secret role:</p>${pick(s, v.people || [], null, 'data-peek')}</div>`);
    }
    if (v.ghoul && v.ghoul.cands && !v.ghoul.pick) out.push(`<div class="kk-card pw red"><div class="kk-h">💀 Ghoul’s feast</div><p>Pick one of your killers. You drain half their pay every round!</p>${pick(s, v.ghoul.cands, null, 'data-ghoul')}</div>`);
    else if (v.ghoul && v.ghoul.pick) out.push(`<div class="kk-card pw dim">💀 You feed on <b>${esc(v.ghoul.pick.name)}</b> every payday.</div>`);
    if (v.haunt && v.phase === 'court') out.push(v.haunt.cands.length ? `<div class="kk-card pw"><div class="kk-h">👻 Haunt <small>once a round</small></div>${v.haunt.used ? '<p>You haunted someone this round. Boo.</p>' : `<p>Haunt one of your killers: steal 15 points and halve their next mission.</p>${pick(s, v.haunt.cands, null, 'data-haunt')}`}</div>` : '<div class="kk-card pw dim">👻 Nobody to haunt (no living player voted to kill you).</div>');
    return out.join('');
  }

  function main(v) {
    const s = v, me = v.mine || {}, J = v.judge, king = (v.ladder || [])[0];
    const isKing = king && king.id === v.me, alive = !me.ghost;
    switch (v.phase) {
      case 'brief': { const M = v.mission || {}; return `<div class="kk-card big"><div class="kk-tag">ROUND ${v.round}</div><h2>${esc(M.icon)} ${esc(M.name)}</h2><p>${esc(M.how)}</p></div>${roleCard(v)}`; }
      case 'mission': return mission(v);
      case 'repel': { const R = v.repel || {}; return `<div class="kk-card big ${R.ok ? 'ok' : 'bad'}"><h2>${R.ok ? '🛡️ Wave repelled!' : '💥 The walls are dented'}</h2><p>${R.defence} defence vs a wave of ${R.wave}.</p><p class="kk-mut">Kingdom: ${R.total} / ${R.target} needed by the end.</p></div>`; }
      case 'court': {
        const coup = alive && !isKing && (v.ladder || []).length >= 3 ? `<button class="kk-coup ${PH.coupArm && Date.now() - PH.coupArm < 4000 ? 'armed' : ''}" id="kk-coup">${PH.coupArm && Date.now() - PH.coupArm < 4000 ? '⚔️ TAP AGAIN TO RISE UP<small>No going back!</small>' : '⚔️ CALL A COUP<small>Needs 60% YES. Fail and you drop to the bottom!</small>'}</button>` : '';
        return `<div class="kk-card"><div class="kk-h">🏰 The court</div><p>Scheme by secret message (💌 tab). ${isKing ? 'You are the King: keep your friends close.' : 'Climb the ladder: make deals, or grab the crown.'}</p></div>${coup}${powers(v)}${roleCard(v)}`;
      }
      case 'dusk': { const D = v.dusk || {}; return `<div class="kk-card big"><h2>${D.hit ? `🗡️ ${nm(s, D.target)} was assassinated!` : '🌒 An attempt was foiled!'}</h2>${D.clue ? `<p class="kk-clue">🔎 ${esc(D.clue)}</p>` : ''}${D.target === v.me && D.hit ? '<p>You are a ghost now. You can still do missions (half strength) and haunt.</p>' : ''}</div>${powers(v)}`; }
      case 'coup': {
        const C = v.coup || {}, mine = C.caller === v.me || C.king === v.me;
        return `<div class="kk-card big red"><div class="kk-tag">COUP!</div><h2>${nm(s, C.caller)} reaches for the crown of ${nm(s, C.king)}</h2><p>Needs <b>${C.need}</b> YES votes.</p>
          ${!alive ? '<p class="kk-mut">Ghosts don’t vote.</p>' : mine ? `<p class="kk-mut">Your vote is ${C.caller === v.me ? 'YES' : 'NO'}.</p>` : `<div class="kk-vote"><button class="kk-btn ${v.coupVote === true ? 'sel' : ''} yes" data-cv="1">⚔️ YES, crown them</button><button class="kk-btn ${v.coupVote === false ? 'sel' : ''} no" data-cv="0">🛡️ NO, defend the King</button></div>`}</div>`;
      }
      case 'coupResult': { const C = v.coup || {}, R = C.result || {}; return `<div class="kk-card big ${R.passed ? 'ok' : 'bad'}"><h2>${R.passed ? `👑 ${nm(s, C.caller)} is the new King!` : `🪤 The coup failed! ${nm(s, C.caller)} drops to the bottom.`}</h2><p>${(R.yes || []).length} yes · ${(R.no || []).length} no (needed ${C.need})</p></div>`; }
      case 'trial': { const T = v.trial || {}; return `<div class="kk-card big"><h2>The old King, ${nm(s, T.old)}…</h2>${!alive || T.old === v.me ? `<p class="kk-mut">${T.old === v.me ? 'Your fate is in their hands. Bargain!' : 'Ghosts don’t vote.'}</p>` : `<div class="kk-vote"><button class="kk-btn ${v.trialVote === false ? 'sel' : ''} yes" data-tv="0">🕊️ SPARE<small>to the bottom</small></button><button class="kk-btn ${v.trialVote === true ? 'sel' : ''} no" data-tv="1">💀 KILL<small>a ghost</small></button></div>`}</div>`; }
      case 'trialResult': { const T = v.trial || {}, R = T.result || {}; return `<div class="kk-card big"><h2>${R.killed ? `💀 ${nm(s, T.old)} is no more.` : `🕊️ ${nm(s, T.old)} is spared, and sent to the stables.`}</h2></div>`; }
      case 'summon': {
        if (isKing) {
          const list = (v.ladder || []).filter((x) => x.id !== v.me), sel = PH.sumT;
          return `<div class="kk-card big"><div class="kk-tag">YOU ARE THE KING</div><h2>⚖️ Summon someone</h2>${pick(s, list, (x) => x.id === sel, 'data-sum', { sub: (x) => `${esc(x.icon)} ${esc(x.title)}` })}
            ${sel ? `<div class="kk-sent">${Object.entries(SENT).map(([k, S]) => `<button class="kk-btn" data-sent="${k}" ${k === 'demote' && list.length && list[list.length - 1].id === sel ? 'disabled' : ''}>${S.icon} ${S.name}</button>`).join('')}</div>` : ''}<button class="kk-link" id="kk-mercy">🕊️ Show mercy (summon nobody)</button></div>`;
        }
        return `<div class="kk-card big"><h2>⚖️ The King is choosing…</h2><p>Who will be summoned? Whisper fast!</p></div>${roleCard(v)}`;
      }
      case 'hearing': {
        const H = v.hearing || {}, S = SENT[J.sentence] || {};
        const head2 = `<div class="kk-card big"><div class="kk-tag">${esc(S.icon || '')} ${esc(S.name || '')}</div><h2>${J.target === v.me ? 'You are accused!' : `${nm(s, J.target)} is accused`}</h2><p>The King wants them to ${esc(S.verb || '')}.</p></div>`;
        let vote = '';
        if (H.voter) vote = `<div class="kk-vote"><button class="kk-btn yes ${H.myVote === 'aye' ? 'sel' : ''}" data-hv="aye">👍 AYE</button><button class="kk-btn no ${H.myVote === 'nay' ? 'sel' : ''}" data-hv="nay">👎 NAY</button></div>`;
        else if (J.target === v.me) vote = '<p class="kk-mut kk-c">Your vote: NAY. Offer deals to save yourself!</p>';
        else if (J.king === v.me) vote = '<p class="kk-mut kk-c">Your vote: AYE. Promise promotions to win votes!</p>';
        else vote = '<p class="kk-mut kk-c">Ghosts don’t vote.</p>';
        const ins = (H.offersIn || []).map((o) => `<div class="kk-deal ${o.accepted ? 'took' : ''}">📜 <b>${esc(o.from.name)}</b>: vote <b>${o.side.toUpperCase()}</b> and ${o.kind === 'rank' ? 'you rise one seat' : `get <b>${o.amount}</b> of their points`}. ${o.accepted ? '<em>✓ You swore it</em>' : `<button class="kk-btn go sm" data-acc="${o.id}">Swear it</button>`}</div>`).join('');
        let outs = '';
        if ((H.canOffer || []).length || (H.offersOut || []).length) {
          const king2 = J.king === v.me;
          outs = `<div class="kk-card"><div class="kk-h">📜 Offer a binding deal <small>${king2 ? 'AYE → they rise one seat' : 'NAY → you pay them'}</small></div>
            ${king2 ? '' : `<div class="kk-amt">${[10, 25, 50].map((a) => `<button class="${PH.gold === a ? 'on' : ''}" data-amt="${a}">${a} pts</button>`).join('')}</div>`}
            ${(H.canOffer || []).length ? pick(s, H.canOffer, null, 'data-offer', { sub: (x) => seatName(v, x.id) }) : ''}
            ${(H.offersOut || []).map((o) => `<p class="kk-mut">→ ${esc(o.to.name)}${o.kind === 'gold' ? ` (${o.amount})` : ''}: ${o.accepted ? '✓ sworn' : 'thinking…'}</p>`).join('')}</div>`;
        }
        return head2 + vote + (ins ? `<div class="kk-card">${ins}</div>` : '') + outs;
      }
      case 'verdict': {
        if (!J || J.mercy) return '<div class="kk-card big"><h2>🕊️ The King shows mercy.</h2></div>';
        const R = J.result || {}, S = SENT[J.sentence] || {};
        const deals = (R.deals || []).filter((d) => d.to === v.me || d.from === v.me).map((d) => `<p>${d.status === 'broken' ? '💔' : '✅'} ${d.to === v.me ? `Your deal with ${nm(s, d.from)}` : `${nm(s, d.to)}’s deal with you`}: ${d.status === 'broken' ? 'oath broken (fine paid)' : d.kind === 'rank' ? 'promotion' : `${d.amount} points`}</p>`).join('');
        return `<div class="kk-card big ${R.passed ? 'bad' : 'ok'}"><h2>${R.passed ? `${S.icon} The sentence stands!` : '🕊️ The court says nay!'}</h2><p>${(R.aye || []).length} aye · ${(R.nay || []).length} nay${R.gallery ? ` · the gallery said ${R.gallery}` : ''}</p>${deals}</div>`;
      }
      case 'pay': { const r = (v.pay || []).find((x) => x.id === v.me) || {}; return `<div class="kk-card big ok"><h2>💰 Payday</h2><p class="kk-bign">+${r.total || 0}</p><p>${r.pay ? `Rank ${r.pay}` : 'No rank pay'} · mission bonus ${r.bonus || 0}${r.drained ? ` · <b class="kk-red">Ghoul drained ${r.drained}</b>` : ''}${r.fed ? ` · fed on ${r.fed}` : ''}</p></div>`; }
      default: return '';
    }
  }
  function endScreen(v) {
    const s = v, S = v.siege || {}, F = v.final || {}, me = v.mine || {};
    let body = '';
    if (v.phase === 'siege') body = `<div class="kk-card big ${S.survived ? 'ok' : 'bad'}"><h2>${S.survived ? '🏰 The kingdom stands!' : '🔥 The kingdom has fallen!'}</h2><p>${S.total} / ${S.target} defence.</p>${S.survived ? '' : `<p>The goblins loot the treasury: everyone keeps a quarter${me.secret && me.secret.k === 'turncloak' ? ', except you, Turncloak (+150)!' : '.'}</p>`}</div>`;
    else {
      const mine = (F.awards || []).filter((a) => a.id === v.me);
      body = `<div class="kk-card big"><div class="kk-tag">${v.phase === 'over' ? 'THE REIGN IS OVER' : 'SECRETS REVEALED'}</div><h2>${v.phase === 'over' ? (v.rank === 1 ? '🏆 You won the kingdom!' : `#${v.rank} of ${v.ranked}`) : `You were the ${esc(me.secret.icon)} ${esc(me.secret.name)}`}</h2><p class="kk-bign">⭐ ${me.points || 0}</p>${mine.map((a) => `<div class="kk-aw">${esc(a.icon)} <b>${esc(a.title)}</b> <small>${esc(a.text)}</small></div>`).join('')}</div>`;
      const f = v.myFeedback;
      body += `<div class="kk-card fb"><div class="kk-h">🧪 This is a TRIAL game <small>was it fun?</small></div>
        <div class="kk-fb"><button class="${f && f.rating === 'up' ? 'on' : ''}" data-fb="up">👍</button><button class="${f && f.rating === 'down' ? 'on' : ''}" data-fb="down">👎</button></div>
        <div class="kk-in"><input id="kk-note" maxlength="200" autocomplete="off" placeholder="Optional: what should change?" value="${esc(PH.fbNote)}"><button class="kk-btn go" id="kk-fbsend">${f ? 'Update' : 'Send'}</button></div>${f ? '<p class="kk-mut kk-c">Thanks! Sir Bellow will pass it on.</p>' : ''}</div>`;
    }
    return body;
  }

  function phone(el, v, ctx, local) {
    if (!v) return;
    v._pp = null; PH.v = v; PH.ctx = ctx; PH.el = el;
    const key = v.phase + ':' + v.round;
    if (!local && key !== PH.last) {
      PH.last = key;
      const me = v.mine || {}, J = v.judge, king = (v.ladder || [])[0];
      if (v.phase === 'mission' || v.phase === 'brief') { PH.tab = 'main'; ctx.haptic(v.phase === 'mission' ? 'turn' : 'big'); }
      else if (v.phase === 'summon' && king && king.id === v.me) { PH.tab = 'main'; PH.sumT = null; ctx.haptic('turn'); }
      else if (v.phase === 'hearing') { PH.tab = 'main'; ctx.haptic(J && J.target === v.me ? 'warn' : 'turn'); }
      else if (v.phase === 'coup' || v.phase === 'trial') { PH.tab = 'main'; ctx.haptic('big'); }
      else if (v.phase === 'dusk' && v.dusk && v.dusk.target === v.me) ctx.haptic(v.dusk.hit ? 'error' : 'warn');
      else if (v.phase === 'repel') ctx.haptic(v.repel && v.repel.ok ? 'success' : 'error');
      else if (v.phase === 'pay') ctx.haptic('success');
      else if (v.phase === 'verdict' && J && J.target === v.me && J.result) ctx.haptic(J.result.passed ? 'error' : 'success');
      else if (v.phase === 'siege') ctx.haptic(v.siege && v.siege.survived ? 'success' : 'error');
      else if (v.phase === 'over') ctx.haptic(v.rank === 1 ? 'win' : 'success');
      if (me.ghost && !PH.wasGhost) { PH.wasGhost = true; ctx.haptic('buzz'); }
    }
    if (v.spectator) return BOX.morph(el, `<div class="kk-ph">${head(v)}<div class="kk-card big"><h2>👀 You’re watching</h2><p>You joined after the crown was handed out. Join the next game!</p></div></div>`);
    const end = ['siege', 'unmask', 'over'].includes(v.phase);
    if (PH.tab === 'inbox') PH.seenMsgs = (v.inbox || []).filter((m) => !m.mine).length;
    const body = end ? endScreen(v) : PH.tab === 'inbox' && v.canMsg ? inbox(v) : tip(v) + main(v);
    BOX.morph(el, `<div class="kk-ph ph-${v.phase} ${(v.mine || {}).ghost ? 'is-ghost' : ''}">${head(v)}${tabs(v)}<div class="kk-body">${body}</div></div>`);
    bind(el, v, ctx);
  }
  function bind(el, v, ctx) {
    const on = (sel, fn) => { for (const b of el.querySelectorAll(sel)) b.onclick = (e) => fn(b, e); };
    const act = async (m, ok = 'select') => { const r = await ctx.act(m); if (r && r.ok) ctx.haptic(ok); else if (r && r.error && !r.miss) ctx.haptic('error'); else if (r && r.miss) ctx.haptic('error'); return r; };
    const pk = el.querySelector('#kk-peek'); if (pk) pk.onclick = () => { PH.peek = !PH.peek; ctx.haptic('tap'); rer(); };
    on('[data-tab]', (b) => { PH.tab = b.dataset.tab; ctx.haptic('tap'); rer(); });
    on('[data-tipx]', (b) => { PH.tips.add(b.dataset.tipx); rer(); });
    // missions
    for (const b of el.querySelectorAll('[data-cell]')) b.onpointerdown = (e) => { e.preventDefault(); act({ op: 'mend', cell: Number(b.dataset.cell) }, 'tap'); };
    for (const b of el.querySelectorAll('[data-rune]')) b.onpointerdown = (e) => { e.preventDefault(); act({ op: 'rune', rune: Number(b.dataset.rune) }, 'success'); };
    const bell = el.querySelector('#kk-bell'); if (bell) bell.onpointerdown = (e) => { e.preventDefault(); act({ op: 'ring' }, 'buzz'); };
    const grip = el.querySelector('#kk-grip');
    if (grip) {
      grip.onpointerdown = (e) => { e.preventDefault(); try { grip.setPointerCapture(e.pointerId); } catch { /* fine */ } ctx.act({ op: 'grip', on: true }); ctx.haptic('tap'); };
      grip.onpointerup = grip.onpointercancel = grip.onlostpointercapture = () => ctx.act({ op: 'grip', on: false });
      grip.oncontextmenu = (e) => e.preventDefault();
    }
    // messages
    on('[data-to]', (b) => { const id = b.dataset.to; if (PH.to.has(id)) PH.to.delete(id); else if (PH.to.size < 3) PH.to.add(id); else ctx.toast('Up to 3 people.'); ctx.haptic('tap'); rer(); });
    on('[data-re]', (b) => { PH.to = new Set(b.dataset.re.split(',').filter(Boolean).slice(0, 3)); ctx.haptic('tap'); rer(); const i = el.querySelector('#kk-text'); if (i) i.focus(); });
    const txt = el.querySelector('#kk-text'); if (txt) txt.oninput = () => { PH.draft = txt.value; const s = el.querySelector('#kk-send'); if (s) s.disabled = !PH.to.size || !v.canMsg; };
    const send = async (text) => { if (!text || !PH.to.size) return ctx.toast(PH.to.size ? 'Write something first.' : 'Pick who to send it to.'); const r = await ctx.act({ op: 'msg', to: [...PH.to], text }); if (r && r.ok) { ctx.haptic('success'); PH.draft = ''; if (txt) { txt.value = ''; txt.blur(); } rer(); } };
    on('[data-pre]', (b) => send((v.presets || [])[Number(b.dataset.pre)]));
    const sb = el.querySelector('#kk-send'); if (sb) sb.onclick = () => send((txt && txt.value || '').trim());
    if (txt) txt.onkeydown = (e) => { if (e.key === 'Enter') send(txt.value.trim()); };
    // court and powers
    const cp = el.querySelector('#kk-coup'); if (cp) cp.onclick = () => { if (!PH.coupArm || Date.now() - PH.coupArm > 4000) { PH.coupArm = Date.now(); ctx.haptic('warn'); rer(); return; } PH.coupArm = 0; act({ op: 'coup' }, 'big'); };
    on('[data-mark]', (b) => act({ op: 'mark', target: b.dataset.mark }));
    const um = el.querySelector('#kk-unmark'); if (um) um.onclick = () => act({ op: 'mark', target: null }, 'tap');
    on('[data-spy]', (b) => act({ op: 'spy', target: b.dataset.spy }));
    on('[data-peek]', (b) => act({ op: 'peek', target: b.dataset.peek }, 'success'));
    on('[data-haunt]', (b) => act({ op: 'haunt', target: b.dataset.haunt }, 'success'));
    on('[data-ghoul]', (b) => act({ op: 'ghoul', target: b.dataset.ghoul }, 'success'));
    // judgement
    on('[data-sum]', (b) => { PH.sumT = b.dataset.sum; ctx.haptic('tap'); rer(); });
    on('[data-sent]', (b) => act({ op: 'summon', target: PH.sumT, sentence: b.dataset.sent }, 'big'));
    const me2 = el.querySelector('#kk-mercy'); if (me2) me2.onclick = () => act({ op: 'summon', mercy: true });
    on('[data-hv]', (b) => act({ op: 'vote', side: b.dataset.hv }));
    on('[data-cv]', (b) => act({ op: 'vote', yes: b.dataset.cv === '1' }));
    on('[data-tv]', (b) => act({ op: 'vote', kill: b.dataset.tv === '1' }));
    on('[data-acc]', (b) => act({ op: 'accept', offer: Number(b.dataset.acc) }, 'success'));
    on('[data-amt]', (b) => { PH.gold = Number(b.dataset.amt); ctx.haptic('tap'); rer(); });
    on('[data-offer]', (b) => act({ op: 'offer', target: b.dataset.offer, amount: PH.gold }, 'success'));
    // trial feedback
    on('[data-fb]', (b) => { PH.fbRating = b.dataset.fb; act({ op: 'feedback', rating: b.dataset.fb, note: PH.fbNote }, 'success'); });
    const note = el.querySelector('#kk-note'); if (note) note.oninput = () => { PH.fbNote = note.value; };
    const fs = el.querySelector('#kk-fbsend'); if (fs) fs.onclick = () => { const r = PH.fbRating || (v.myFeedback && v.myFeedback.rating); if (!r) return ctx.toast('Tap 👍 or 👎 first.'); act({ op: 'feedback', rating: r, note: PH.fbNote }, 'success'); };
  }

  // ================================================================= TV
  const TV = { s: null, cv: null, raf: 0, said: null, sayUntil: 0, host: null, anim: null, hcv: null, flown: new Set(), lastPeal: 0, rings: [], fxMark: 0 };
  const heraldSpec = () => { const I = BOX.intros && BOX.intros.king; return I && I.host ? I.host : null; };
  function speak(text) {
    const talk = (ms) => { TV.sayUntil = Date.now() + ms; if (TV.anim) TV.anim.talk(performance.now(), ms); };
    try { if (BOX.voice && BOX.voice.speak) { BOX.voice.speak(text, (heraldSpec() || {}).voice || {}, { onstart: talk }); return; } } catch { /* no voice */ }
    talk(Math.max(1500, text.length * 60));
  }
  function fitCv(cv) {
    const r = cv.getBoundingClientRect(), dpr = Math.min(1.5, window.devicePixelRatio || 1), w = Math.max(10, Math.round(r.width * dpr)), h = Math.max(10, Math.round(r.height * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    return cv.getContext('2d');
  }
  const R = (seed) => { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
  const r0 = R(77), STARS = Array.from({ length: 70 }, () => [r0(), r0() * 0.5, 0.5 + r0() * 1.5, r0() * 6]);
  const GOB = Array.from({ length: 60 }, () => [r0(), r0(), 0.8 + r0() * 0.4, r0() * 6]);
  // The castle outside (missions) or the throne room (court and judgement), drawn every frame.
  function scene() {
    TV.raf = requestAnimationFrame(scene);
    const cv = TV.cv, s = TV.s; if (!cv || !cv.isConnected || !s) return;
    const g = fitCv(cv), W = cv.width, H = cv.height, t = performance.now() / 1000;
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (isRoom(s.phase)) hall(g, W, H, t, s); else field(g, W, H, t, s);
    drawHerald();
  }
  function field(g, W, H, t, s) {
    const k = W / 1920;
    let gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1b1440'); gr.addColorStop(0.55, '#6a2c5a'); gr.addColorStop(0.8, '#e0794a'); gr.addColorStop(1, '#f2b25c'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (const [x, y, r, p] of STARS) { g.globalAlpha = 0.4 + 0.4 * Math.sin(t * 1.3 + p); g.fillStyle = '#fff6d8'; g.beginPath(); g.arc(x * W, y * H * 0.8, r * k, 0, 7); g.fill(); }
    g.globalAlpha = 1;
    // hills
    g.fillStyle = '#3a1f3e'; g.beginPath(); g.moveTo(0, H * 0.72); for (let x = 0; x <= W; x += 40 * k) g.lineTo(x, H * 0.7 - Math.sin(x / W * 7 + 1) * 40 * k - Math.sin(x / W * 17) * 14 * k); g.lineTo(W, H); g.lineTo(0, H); g.fill();
    g.fillStyle = '#2a1630'; g.fillRect(0, H * 0.83, W, H);
    // the defence of this wave pushes the goblins back
    const M = s.mission || {}, prog = M.wave ? Math.min(1.2, (M.defence || 0) / M.wave) : 0.5;
    const front = s.phase === 'mission' ? 0.55 + 0.33 * Math.min(1, prog) : s.phase === 'repel' ? (s.repel && s.repel.ok ? 0.97 : 0.56) : 0.92;
    // goblins (right), marching toward the wall
    const n = Math.min(GOB.length, 18 + Math.round((M.wave || 300) / 25));
    for (let i = 0; i < n; i++) {
      const [a, b, sc, p] = GOB[i], x = W * (front + a * 0.36 - 0.02), y = H * (0.84 + b * 0.12), z = sc * k * (0.8 + b * 0.5), bob = Math.abs(Math.sin(t * 5 + p)) * 6 * z;
      goblin(g, x + Math.sin(t * 0.8 + p) * 6 * k, y - bob, z * 1.15, t + p);
    }
    // the castle (left)
    castle(g, W, H, k, t, s);
    // mission effects
    if (s.phase === 'mission' && M.key === 'beacons') for (let i = 0; i < 4; i++) fire(g, W * (0.08 + i * 0.12), H * 0.3 + (i % 2) * 30 * k, k * (1 + 0.2 * Math.sin(t * 3 + i)), t + i);
    if (s.phase === 'mission' && M.key === 'bells') { const pe = M.peals || []; if (pe.length && pe.length !== TV.lastPealN) { TV.lastPealN = pe.length; TV.rings.push({ at: t, k: pe[pe.length - 1] }); } }
    TV.rings = TV.rings.filter((r) => t - r.at < 1.6);
    for (const r of TV.rings) { const u = (t - r.at) / 1.6; g.strokeStyle = `rgba(255,224,130,${1 - u})`; g.lineWidth = (2 + r.k * 2) * k; g.beginPath(); g.arc(W * 0.26, H * 0.2, (40 + u * 300 * Math.min(2, r.k / 2)) * k, 0, 7); g.stroke(); }
  }
  function goblin(g, x, y, z, t) {
    g.save(); g.translate(x, y); g.scale(z, z);
    g.fillStyle = '#3d7a2f'; g.strokeStyle = '#1a0b12'; g.lineWidth = 3;
    g.beginPath(); g.ellipse(0, -26, 14, 18, 0, 0, 7); g.fill(); g.stroke(); // body
    g.beginPath(); g.arc(0, -54, 13, 0, 7); g.fill(); g.stroke(); // head
    g.beginPath(); g.moveTo(-11, -58); g.lineTo(-26, -66); g.lineTo(-10, -50); g.closePath(); g.fill(); g.stroke(); // ears
    g.beginPath(); g.moveTo(11, -58); g.lineTo(26, -66); g.lineTo(10, -50); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#ffde3a'; g.beginPath(); g.arc(-5, -56, 2.6, 0, 7); g.arc(5, -56, 2.6, 0, 7); g.fill();
    g.strokeStyle = '#6b4a2a'; g.lineWidth = 4; g.beginPath(); g.moveTo(-16, -10); g.lineTo(-22 + Math.sin(t * 5) * 2, -84); g.stroke(); // spear
    g.fillStyle = '#c9ced6'; g.beginPath(); g.moveTo(-22 + Math.sin(t * 5) * 2, -96); g.lineTo(-27, -82); g.lineTo(-17, -82); g.closePath(); g.fill();
    g.restore();
  }
  function fire(g, x, y, z, t) {
    g.save(); g.translate(x, y); g.scale(z, z); g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(0, 0, 4, 0, -10, 70); gr.addColorStop(0, 'rgba(255,220,120,0.9)'); gr.addColorStop(1, 'rgba(255,90,30,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, -10, 70, 0, 7); g.fill();
    g.fillStyle = '#ffb02e'; g.beginPath(); g.moveTo(-14, 0); g.quadraticCurveTo(-10 + Math.sin(t * 9) * 4, -30, 0, -46 - Math.sin(t * 7) * 6); g.quadraticCurveTo(10, -26, 14, 0); g.fill();
    g.restore();
  }
  function castle(g, W, H, k, t, s) {
    const K = s.kingdom || {}, hist = K.history || [], dents = hist.filter((h) => !h.ok).length;
    const stone = '#8a7f92', dark = '#5a4e66', OL = '#1a0b12', wx = W * 0.47, top = H * 0.48;
    g.lineWidth = 5 * k; g.strokeStyle = OL;
    // towers
    for (const [x, w, h] of [[W * 0.03, 150, 520], [W * 0.2, 170, 600], [W * 0.38, 150, 500]]) {
      const tw = w * k, th = h * k, ty = H * 0.88 - th;
      g.fillStyle = stone; g.fillRect(x, ty, tw, th); g.strokeRect(x, ty, tw, th);
      for (let i = 0; i < 4; i++) { g.fillStyle = stone; g.fillRect(x + i * tw / 4 + 4 * k, ty - 26 * k, tw / 4 - 10 * k, 26 * k); g.strokeRect(x + i * tw / 4 + 4 * k, ty - 26 * k, tw / 4 - 10 * k, 26 * k); }
      g.fillStyle = '#2b1d33'; g.fillRect(x + tw / 2 - 12 * k, ty + 70 * k, 24 * k, 48 * k);
      // banner
      g.fillStyle = '#b8233a'; g.beginPath(); g.moveTo(x + tw / 2, ty - 110 * k); g.lineTo(x + tw / 2 + (60 + Math.sin(t * 3 + x) * 8) * k, ty - 96 * k); g.lineTo(x + tw / 2, ty - 80 * k); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(x + tw / 2, ty - 26 * k); g.lineTo(x + tw / 2, ty - 115 * k); g.stroke();
    }
    // the wall
    g.fillStyle = stone; g.fillRect(0, top + 120 * k, wx, H * 0.88 - top - 120 * k); g.strokeRect(-10, top + 120 * k, wx + 10, H * 0.88 - top - 120 * k);
    g.strokeStyle = dark; g.lineWidth = 2 * k;
    for (let y = top + 150 * k, r = 0; y < H * 0.88; y += 34 * k, r++) for (let x = (r % 2) * 40 * k; x < wx; x += 80 * k) g.strokeRect(x, y, 80 * k, 34 * k);
    // the gate
    g.fillStyle = '#4a2c18'; g.strokeStyle = OL; g.lineWidth = 5 * k;
    const gx = wx * 0.62, gw = 150 * k, gh = 190 * k, gy = H * 0.88 - gh;
    g.beginPath(); g.moveTo(gx, H * 0.88); g.lineTo(gx, gy + 60 * k); g.arc(gx + gw / 2, gy + 60 * k, gw / 2, Math.PI, 0); g.lineTo(gx + gw, H * 0.88); g.closePath(); g.fill(); g.stroke();
    if (s.phase === 'mission' && (s.mission || {}).key === 'gate') { g.strokeStyle = '#c9ced6'; g.lineWidth = 3 * k; for (let i = 0; i < 3; i++) { const a = t * 2 + i * 2.1; g.beginPath(); g.moveTo(gx + gw / 2, gy + 60 * k); g.lineTo(gx + gw / 2 + Math.cos(a) * 50 * k, gy + 60 * k + Math.sin(a) * 50 * k); g.stroke(); } }
    // dents: one crack per missed wave
    g.strokeStyle = OL; g.lineWidth = 4 * k;
    for (let i = 0; i < dents; i++) { const x = wx * (0.15 + i * 0.18), y = top + 180 * k; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 20 * k, y + 40 * k); g.lineTo(x - 6 * k, y + 70 * k); g.lineTo(x + 18 * k, y + 120 * k); g.stroke(); }
    if (s.phase === 'siege' && s.siege && !s.siege.survived) for (let i = 0; i < 5; i++) fire(g, W * (0.05 + i * 0.09), H * 0.55, k * 2, t + i);
  }
  // The throne room: stone, banners, torches, the throne with the King (or empty).
  function hall(g, W, H, t, s) {
    const k = W / 1920, OL = '#1a0b12';
    let gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#2a1b3d'); gr.addColorStop(1, '#130b1f'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2 * k;
    for (let y = 0, r = 0; y < H * 0.78; y += 60 * k, r++) for (let x = (r % 2) * 60 * k; x < W; x += 120 * k) g.strokeRect(x, y, 120 * k, 60 * k);
    // floor
    gr = g.createLinearGradient(0, H * 0.78, 0, H); gr.addColorStop(0, '#3b2a22'); gr.addColorStop(1, '#1d130f'); g.fillStyle = gr; g.fillRect(0, H * 0.78, W, H);
    // red carpet to the throne
    g.fillStyle = '#8e1b2e'; g.beginPath(); g.moveTo(W * 0.36 - 80 * k, H * 0.78); g.lineTo(W * 0.36 + 80 * k, H * 0.78); g.lineTo(W * 0.36 + 220 * k, H); g.lineTo(W * 0.36 - 220 * k, H); g.closePath(); g.fill();
    // banners
    for (const x of [W * 0.08, W * 0.64]) { g.fillStyle = '#7a1a5a'; g.beginPath(); g.moveTo(x, 40 * k); g.lineTo(x + 120 * k, 40 * k); g.lineTo(x + 120 * k, 420 * k); g.lineTo(x + 60 * k, 380 * k); g.lineTo(x, 420 * k); g.closePath(); g.fill(); g.lineWidth = 4 * k; g.strokeStyle = '#e0b84a'; g.stroke(); g.font = `${70 * k}px serif`; g.textAlign = 'center'; g.fillStyle = '#e0b84a'; g.fillText('👑', x + 60 * k, 200 * k); }
    // torches
    for (const x of [W * 0.2, W * 0.52]) { g.fillStyle = '#4a2c18'; g.fillRect(x - 6 * k, 300 * k, 12 * k, 60 * k); fire(g, x, 300 * k, k, t + x); }
    // the throne
    const tx = W * 0.36, ty = H * 0.78;
    g.fillStyle = '#d4a63a'; g.strokeStyle = OL; g.lineWidth = 6 * k;
    g.beginPath(); g.moveTo(tx - 130 * k, ty); g.lineTo(tx - 130 * k, ty - 420 * k); g.quadraticCurveTo(tx, ty - 520 * k, tx + 130 * k, ty - 420 * k); g.lineTo(tx + 130 * k, ty); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#7a1a2e'; g.beginPath(); g.moveTo(tx - 95 * k, ty - 60 * k); g.lineTo(tx - 95 * k, ty - 380 * k); g.quadraticCurveTo(tx, ty - 450 * k, tx + 95 * k, ty - 380 * k); g.lineTo(tx + 95 * k, ty - 60 * k); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#d4a63a'; g.fillRect(tx - 150 * k, ty - 150 * k, 300 * k, 40 * k); g.strokeRect(tx - 150 * k, ty - 150 * k, 300 * k, 40 * k);
    const end = s.phase === 'unmask' || s.phase === 'over', king = end ? null : (s.ladder || [])[0];
    if (king && BOX.drawChar) { try { BOX.drawChar(g, tx, ty - 108 * k, king, { scale: 2.6 * k, t }); } catch { /* fine */ } }
    if (king) { g.font = `${54 * k}px serif`; g.textAlign = 'center'; g.fillText('👑', tx, ty - 370 * k + Math.sin(t * 2) * 6 * k); }
    // dimmer for readability
    g.fillStyle = end ? 'rgba(10,4,20,0.6)' : 'rgba(10,4,20,0.25)'; g.fillRect(0, 0, W, H);
  }
  function drawHerald() {
    const cv = TV.hcv; if (!cv || !cv.isConnected) return;
    const H = heraldSpec(); if (!H || !BOX.studio) return;
    if (!TV.host) { try { TV.host = H.draw ? H.draw.bind(H) : BOX.studio.makeHost(H.look || {}); TV.anim = new BOX.studio.HostAnim(H); } catch { return; } }
    const g = fitCv(cv); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
    const sc = cv.height / 520; g.translate(cv.width / 2, cv.height * 1.02); g.scale(sc, sc);
    if (Date.now() < TV.sayUntil && TV.anim.talkUntil < performance.now()) TV.anim.talk(performance.now(), TV.sayUntil - Date.now());
    try { TV.host(g, TV.anim.frame(performance.now())); } catch { /* drawing */ }
  }
  function mount(el) {
    const sc = el.querySelector('#kk-scene'); if (sc && !sc.querySelector('canvas')) sc.innerHTML = '<canvas></canvas>';
    TV.cv = sc && sc.querySelector('canvas');
    const hb = el.querySelector('#kk-herald'); if (hb && !hb.querySelector('canvas')) hb.innerHTML = '<canvas></canvas>';
    TV.hcv = hb && hb.querySelector('canvas');
    if (BOX.studio && BOX.studio.need) BOX.studio.need('king', () => {});
    if (!TV.raf) TV.raf = requestAnimationFrame(scene);
  }

  function ladderHtml(s) {
    const L = s.ladder || [], G = s.ghosts || [], pay = new Map((s.pay || []).map((r) => [r.id, r]));
    let lastTier = '';
    const rows = L.map((x) => {
      const t = x.tier !== lastTier ? `<div class="kk-tier t-${x.tier}">${esc(x.tierName)} <small>${x.pay}/round</small></div>` : ''; lastTier = x.tier;
      const p = pay.get(x.id);
      return `${t}<div class="kk-rung t-${x.tier} ${x.seat === 0 ? 'king' : ''}" id="kk-rung-${esc(x.id)}">${fc(x, x.seat === 0 ? 54 : 40)}<span><b>${esc(x.name)}</b><small>${esc(x.icon)} ${esc(x.title)}</small></span><em>${p ? `+${p.total}` : `⭐ ${x.points}`}</em></div>`;
    }).join('');
    const gh = G.length ? `<div class="kk-tier t-ghost">👻 Ghosts <small>half-strength</small></div>${G.map((x) => { const p = pay.get(x.id); return `<div class="kk-rung ghost">${fc(x, 34)}<span><b>${esc(x.name)}</b></span><em>${p && p.fed ? `+${p.fed}` : `⭐ ${x.points}`}</em></div>`; }).join('')}` : '';
    return `<div class="kk-ladder"><div class="kk-lh">THE LADDER</div>${rows}${gh}</div>`;
  }
  function meter(s) {
    const K = s.kingdom || {}, pct = K.target ? Math.min(100, (K.total / K.target) * 100) : 0;
    const marks = []; let acc = 0; for (const w of K.waves || []) { acc += w; marks.push((acc / K.target) * 100); }
    return `<div class="kk-meter"><div class="kk-ml">🏰 Kingdom defence <b>${K.total}</b> / ${K.target}</div><div class="kk-mbar"><i style="width:${pct.toFixed(1)}%"></i>${marks.map((m, i) => `<span style="left:${m.toFixed(1)}%" class="${i < s.round ? 'past' : ''}">${i + 1}</span>`).join('')}</div></div>`;
  }
  function center(s) {
    const J = s.judge, C = s.coup, T = s.trial;
    switch (s.phase) {
      case 'brief': { const M = s.mission || {}; return `<div class="kk-scroll in" id="kk-b-${s.round}"><div class="kk-tag">ROUND ${s.round} OF ${s.of}</div><h1>${esc(M.icon)} ${esc(M.name)}</h1><p>${esc(M.how)}</p><div class="kk-wave">⚔️ Goblin wave: <b>${M.wave}</b> strength</div></div>`; }
      case 'mission': {
        const M = s.mission || {}, pct = M.wave ? Math.min(100, (M.defence / M.wave) * 100) : 0;
        let extra = '';
        if (M.key === 'beacons' && (M.shouts || []).length) extra = `<div class="kk-shouts">${M.shouts.map((x) => `<span>${fc(who(s, x.id), 34)}<b>${esc(who(s, x.id).name)}</b> shouts <i>${RUNES[x.rune]}</i></span>`).join('')}</div>`;
        if (M.key === 'gate') extra = `<div class="kk-groups">${(M.groups || []).map((g) => `<span class="${g.turning ? 'turn' : ''}">${g.ids.map((id) => fc(who(s, id), 34)).join('')}${g.turning ? '⚙️' : '✋'}</span>`).join('')}</div>`;
        if (M.key === 'bells') extra = `<div class="kk-peals">${(M.peals || []).slice(-6).map((k) => `<span>${'🔔'.repeat(Math.min(6, k))}</span>`).join('')}</div>`;
        return `<div class="kk-mis"><h2>${esc(M.icon)} ${esc(M.name)}</h2><div class="kk-wbar"><i style="width:${pct.toFixed(1)}%"></i><b>${M.defence} / ${M.wave}</b></div>${extra}</div>`;
      }
      case 'repel': { const R = s.repel || {}; return `<div class="kk-scroll ${R.ok ? 'ok' : 'bad'}" id="kk-r-${s.round}"><h1>${R.ok ? 'REPELLED!' : 'BREACHED!'}</h1><p><b>${R.defence}</b> defence vs a wave of <b>${R.wave}</b></p><div class="kk-tops">${(R.top || []).slice(0, 6).map((x) => `<span>${fc(x, 40)}${esc(x.name)} <b>${x.units}</b></span>`).join('')}</div></div>`; }
      case 'court': case 'dusk': return court(s);
      case 'coup': case 'coupResult': {
        const R = C && C.result, n = (C && C.voted || []).length;
        return `<div class="kk-coupset ${R ? (R.passed ? 'won' : 'lost') : ''}" id="kk-coup-${s.round}"><h1>⚔️ COUP! ⚔️</h1><div class="kk-duel"><div>${fc(who(s, C.caller), 150)}<b>${nm(s, C.caller)}</b><small>reaches for the crown</small></div><span class="kk-vs">VS</span><div>${fc(who(s, C.king), 150)}<b>${nm(s, C.king)}</b><small>👑 the King</small></div></div>
          ${R ? `<div class="kk-cres"><div class="yes">⚔️ ${R.yes.map((id) => fc(who(s, id), 44)).join('')}</div><div class="no">🛡️ ${R.no.map((id) => fc(who(s, id), 44)).join('')}</div></div><h2>${R.passed ? `👑 LONG LIVE KING ${nm(s, C.caller).toUpperCase()}!` : '🪤 THE COUP IS CRUSHED!'}</h2>` : `<p class="kk-need">Needs <b>${C.need}</b> YES of ${C.voters} · ${n} voted</p><div class="kk-pips">${Array.from({ length: C.voters }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div>`}</div>`;
      }
      case 'trial': case 'trialResult': {
        const R = T && T.result;
        return `<div class="kk-scroll" id="kk-tr-${s.round}"><h1>The old King</h1>${fc(who(s, T.old), 160)}<h2>${nm(s, T.old)}</h2>${R ? `<h2 class="${R.killed ? 'kk-red' : ''}">${R.killed ? '💀 KILLED: a ghost now' : '🕊️ SPARED: to the stables'}</h2><p>💀 ${R.kill.length} · 🕊️ ${R.spare.length}</p>` : `<p>SPARE or KILL? Vote on your phones. ${T.voted.length}/${T.voters} voted</p>`}</div>`;
      }
      case 'summon': return `<div class="kk-scroll" id="kk-s-${s.round}"><h1>⚖️ Judgement</h1><p>The King, <b>${nm(s, J.king)}</b>, chooses who to summon…</p><p class="kk-mut">Kill · Demote · Reveal their messages</p></div>`;
      case 'hearing': {
        const S = SENT[J.sentence] || {};
        return `<div class="kk-court2" id="kk-h-${s.round}"><div class="kk-plaque">${S.icon} ${S.name}</div><div class="kk-acc">${fc(who(s, J.target), 170)}<b>${nm(s, J.target)}</b><small>stands accused</small></div>
          <p>AYE or NAY on your phones · ${J.voted.length + 2}/${J.voters} votes in${J.deals ? ` · 📜 ${J.deals} deal${J.deals === 1 ? '' : 's'} on the table` : ''}</p><div class="kk-pips">${J.voted.map((id) => `<i class="on fly">${fc(who(s, id), 40)}</i>`).join('')}</div></div>`;
      }
      case 'verdict': {
        if (J && J.mercy) return '<div class="kk-scroll ok"><h1>🕊️ Mercy</h1><p>The King summons no one today.</p></div>';
        const R = J.result || {}, S = SENT[J.sentence] || {}, rv = J.revealed;
        const deals = (R.deals || []).map((d) => `<p>${d.status === 'broken' ? '💔' : '📜'} ${nm(s, d.to)} ${d.status === 'broken' ? `BROKE their oath to ${nm(s, d.from)}` : d.kind === 'rank' ? `rose a seat (the King’s deal)` : `was paid ${d.amount} by ${nm(s, d.from)}`}</p>`).join('');
        return `<div class="kk-verdict ${R.passed ? 'pass' : 'fail'}" id="kk-v-${s.round}"><h1>${R.passed ? `${S.icon} ${S.name}!` : 'NAY! Acquitted!'}</h1><div class="kk-cols"><div class="aye"><h3>👍 AYE</h3>${(R.aye || []).map((id, i) => `<span style="--i:${i}">${fc(who(s, id), 50)}</span>`).join('')}</div><div class="kk-acc sm">${fc(who(s, J.target), 120)}<b>${nm(s, J.target)}</b></div><div class="nay"><h3>👎 NAY</h3>${(R.nay || []).map((id, i) => `<span style="--i:${i}">${fc(who(s, id), 50)}</span>`).join('')}</div></div>
          ${R.gallery ? `<p class="kk-mut">The gallery added a vote: ${esc(R.gallery.toUpperCase())}</p>` : ''}${deals ? `<div class="kk-deals">${deals}</div>` : ''}
          ${rv ? `<div class="kk-reveal"><h3>📜 The messages of ${nm(s, rv.id)}</h3>${rv.msgs.map((m) => `<p>→ ${esc(m.to.join(', '))}: “${esc(BOX.filterText ? BOX.filterText(m.text) : m.text)}”</p>`).join('') || '<p class="kk-mut">…they sent nothing at all. Suspicious.</p>'}</div>` : ''}</div>`;
      }
      case 'pay': return `<div class="kk-scroll" id="kk-p-${s.round}"><h1>💰 Payday</h1><p>Crown 100 · Nobles 60 · Guild 35 · Commons 15 · plus a mission bonus</p>${(s.pay || []).some((r) => r.drained) ? `<p class="kk-red">💀 The Ghoul feeds…</p>` : ''}</div>`;
      default: return '';
    }
  }
  // The court: everyone in an arc, a line between each pair that is talking (never what they say).
  function court(s) {
    const ids = [...(s.ladder || []).map((x) => x.id), ...(s.ghosts || []).map((x) => x.id)], n = ids.length;
    const pos = new Map(ids.map((id, i) => { const a = Math.PI * (0.06 + 0.88 * (n === 1 ? 0.5 : i / (n - 1))); return [id, [50 - Math.cos(a) * 45, 72 - Math.sin(a) * 58]]; }));
    const P = (s.court && s.court.pairs) || [];
    const lines = P.filter((p) => pos.has(p.a) && pos.has(p.b)).map((p) => { const [x1, y1] = pos.get(p.a), [x2, y2] = pos.get(p.b); return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" style="stroke-width:${Math.min(1.6, 0.3 + p.n * 0.18)}"/>`; }).join('');
    const faces = ids.map((id) => { const [x, y] = pos.get(id), g = (s.ghosts || []).some((z) => z.id === id); return `<div class="kk-cp ${g ? 'ghost' : ''}" id="kk-cp-${esc(id)}" style="left:${x}%;top:${y}%">${fc(who(s, id), 70)}<b>${nm(s, id)}</b></div>`; }).join('');
    const D = s.dusk;
    return `<div class="kk-court" id="kk-court"><svg viewBox="0 0 100 100" preserveAspectRatio="none">${lines}</svg>${faces}<div class="kk-fly" id="kk-fly" data-keep></div>
      <div class="kk-cnote">${s.phase === 'dusk' && D ? `<b>${D.hit ? `🗡️ ${nm(s, D.target)} was found dead!` : `🌒 ${nm(s, D.target)} survived an attempt!`}</b>${D.clue ? `<span>🔎 ${esc(D.clue)}</span>` : ''}` : `<i>💌 <b>${(s.court || {}).total || 0}</b> secret messages this round${(s.court || {}).coupCalled ? ' · ⚔️ A COUP IS CALLED!' : ''}</i>`}</div></div>`;
  }
  function flights(el, s) {
    const box = el.querySelector('#kk-fly'), C = s.court; if (!box || !C) return;
    for (const f of C.flights || []) {
      if (TV.flown.has(f.id)) continue; TV.flown.add(f.id);
      const a = el.querySelector(`#kk-cp-${CSS.escape(f.from)}`), b = el.querySelector(`#kk-cp-${CSS.escape(f.to)}`); if (!a || !b) continue;
      const e = document.createElement('span'); e.className = 'kk-env'; e.textContent = '✉️'; box.appendChild(e);
      try { e.animate([{ left: a.style.left, top: a.style.top, transform: 'translate(-50%,-50%) scale(0.6)' }, { left: b.style.left, top: b.style.top, transform: 'translate(-50%,-50%) scale(1.2)' }], { duration: 1400, easing: 'ease-in-out' }).onfinish = () => e.remove(); } catch { e.remove(); }
      clip('scroll.ogg', { vol: 0.08, gap: 250 });
    }
  }
  function endTv(s) {
    const S = s.siege || {};
    if (s.phase === 'siege') return `<div class="kk-end ${S.survived ? 'ok' : 'bad'}" id="kk-siege"><h1>${S.survived ? '🏰 THE KINGDOM STANDS!' : '🔥 THE KINGDOM HAS FALLEN!'}</h1><p>Total defence <b>${S.total}</b> of <b>${S.target}</b> needed.</p>${S.survived ? '<p>The goblins flee into the hills!</p>' : '<p>The goblins loot the treasury: everyone keeps only a QUARTER of their points…<br>…except a Turncloak, who gets paid.</p>'}</div>`;
    const sec = (s.secrets || []).filter((x) => x.secret !== 'loyal').concat((s.secrets || []).filter((x) => x.secret === 'loyal'));
    if (s.phase === 'unmask') return `<div class="kk-end" id="kk-unmask"><h1>🎭 The secrets of the court</h1><div class="kk-masks">${sec.map((x, i) => `<div class="kk-mask ${x.secret}" style="--i:${i}"><div class="kk-mf">${fc(x, 90)}</div><b>${esc(x.name)}</b><span>${SECRET_ICON[x.secret]} ${SECRET_NAME[x.secret]}</span></div>`).join('')}</div></div>`;
    const F = s.final || {}, st = F.standings || s.standings || [], pod = st.slice(0, 3), order = [1, 0, 2].filter((i) => pod[i]);
    return `<div class="kk-end over" id="kk-over"><h1>👑 ${esc((st[0] || {}).name || '')} wins the kingdom!</h1>
      <div class="kk-ov"><div class="kk-podium">${order.map((i) => `<div class="kk-pod p${i + 1}"><div class="kk-pfig">${fig(pod[i], i === 0 ? 230 : 170)}</div><b>${esc(pod[i].name)}</b><span>⭐ ${pod[i].points}</span><div class="kk-step">${i + 1}</div></div>`).join('')}</div>
      <div class="kk-riv"><h3>⚔️ Rivalries</h3>${(F.rivalries || []).map((r) => `<p>${esc(r.icon)} ${esc(BOX.filterText ? BOX.filterText(r.text) : r.text)}</p>`).join('') || '<p>A peaceful court. Suspiciously peaceful.</p>'}
      <div class="kk-aws">${(F.awards || []).map((a) => `<span>${esc(a.icon)} <b>${esc(a.title)}</b> ${esc(a.name)}</span>`).join('')}</div></div></div>
      <div class="kk-rest">${st.slice(3, 12).map((r, i) => `<span>${i + 4}. ${fc(r, 26)} ${esc(r.name)} <b>${r.points}</b></span>`).join('')}</div>
      <div class="kk-fbt">🧪 TRIAL game: rate it on your phones! ${s.feedback ? `👍 ${s.feedback.up} · 👎 ${s.feedback.down}` : ''}</div></div>`;
  }
  function tv(el, s) {
    if (!s) return;
    s._pp = null; TV.s = s;
    if (BOX.voice && BOX.voice.preload && !TV.pre) { TV.pre = true; try { BOX.voice.preload('king'); } catch { /* no */ } }
    if (s.herald && TV.said !== s.herald.key) { TV.said = s.herald.key; speak(s.herald.text); }
    const end = ['siege', 'unmask', 'over'].includes(s.phase);
    const top = `<div class="kk-top"><div class="kk-plate"><small>ROUND</small><b>${s.round || 1}<span>/${s.of}</span></b></div><div class="kk-ph-name">${esc(PHASE_NAME[s.phase] || '')}</div><span class="kk-trial big">TRIAL</span>${s.practice ? '' : ''}
      ${meter(s)}<div class="kk-clock ${s.endsIn && s.endsIn < 10000 ? 'low' : ''}">${s.endsIn && s.phase !== 'over' ? timer(s.endsIn) : ''}</div></div>`;
    const teach = s.tutor && TEACH[s.phase] ? `<div class="kk-teach">📜 <b>How it works:</b> ${esc(TEACH[s.phase])}</div>` : '';
    const H = s.herald;
    BOX.morph(el, `<div class="kk-tv ph-${s.phase} ${isRoom(s.phase) ? 'room' : 'field'}"><div class="kk-scene" id="kk-scene" data-keep></div>${top}
      <div class="kk-herald" id="kk-herald" data-keep></div>${H ? `<div class="kk-bub" id="kk-bub-${H.key}"><small>SIR BELLOW</small><p>${esc(H.text)}</p></div>` : ''}
      ${end ? '' : `<div class="kk-side">${ladderHtml(s)}${(s.clues || []).length ? `<div class="kk-clues"><b>🔎 Assassin clues</b>${s.clues.map((c) => `<p>${esc(c)}</p>`).join('')}</div>` : ''}</div>`}
      <div class="kk-main ${end ? 'wide' : ''}">${end ? endTv(s) : center(s)}</div>${teach}</div>`);
    mount(el);
    if (s.phase === 'court') flights(el, s);
  }

  // ================================================================= LOBBY
  function lobbyTv(el, L) {
    if (!el.querySelector('.kk-lobby')) {
      el.innerHTML = `<div class="kk-lobby"><div class="kk-lbg"></div>
        <div class="kk-l-head"><div class="kk-logo">Kill the <b>King</b><span class="kk-trial big">TRIAL</span></div><p>Defend the castle together. Climb the ladder alone. Seize the crown if you dare.</p></div>
        <div class="kk-l-main">
          <div class="kk-l-scroll"><div class="kk-tab">ROYAL DECREE</div><div class="kk-l-set" id="settings"></div><div class="kk-l-err" id="lobby-err"></div>
            <button class="kk-l-start" id="start">👑 Open the court</button><p class="kk-l-note">🧪 A trial game: it may be rough. Tell us what you think at the end!</p>
            <div class="kk-l-links"><button class="link" id="add-bots">+ 5 test bots</button> <button class="link" id="pick">🎮 Another game</button></div></div>
          <div class="kk-l-seal"><div class="kk-l-bh">SUMMONS</div><img id="qr" alt="QR code to join"><div class="kk-l-cl">Room code</div><div class="kk-l-code" id="code"></div></div>
        </div>
        <div class="kk-l-rail"><div class="kk-l-roster" id="roster"></div></div></div>`;
      el.querySelector('#start').onclick = async () => { const r = await L.start(); el.querySelector('#lobby-err').textContent = r && r.ok ? '' : (r && r.error) || ''; };
      el.querySelector('#add-bots').onclick = () => L.bots(5);
      el.querySelector('#pick').onclick = () => L.pick();
    }
    el.querySelector('#code').textContent = L.code;
    const q = el.querySelector('#qr'); if (q.dataset.u !== L.qr) { q.src = L.qr; q.dataset.u = L.qr; }
    const set = el.querySelector('#settings'), sig = JSON.stringify(L.settings);
    if (set.dataset.sig !== sig && !set.contains(document.activeElement)) {
      set.dataset.sig = sig;
      set.innerHTML = L.fields.map((f) => `<label class="kk-l-f"><span>${esc(f.label)}</span><select data-set="${esc(f.key)}">${f.options.map((o) => `<option value="${esc(String(o.value))}" ${String(L.settings[f.key]) === String(o.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`).join('');
      for (const s of set.querySelectorAll('[data-set]')) s.onchange = () => L.set(s.dataset.set, s.value);
    }
    BOX.morph(el.querySelector('#roster'), L.players.map((p, i) => `<span class="chip kk-l-p" style="--c:${esc(p.color || '#e0b84a')}">${fc(p, 44)}<span><small>${i === 0 ? '👑 FIRST IN' : 'COURTIER'}</small>${esc(p.name)}</span></span>`).join('') || '<span class="kk-l-empty">Scan the summons to join the court. 5–10 is perfect (4–12 works).</span>');
  }

  BOX.games.king = {
    name: 'Kill the King', icon: '🗡️', trial: true,
    about: 'TRIAL: defend the castle from goblins together, while you scheme, strike deals and stage coups to climb the social ladder. Only one of you can wear the crown.',
    how: [
      'Every round starts with a MISSION on your phone: mend the wall, light the beacons, ring the bells, man the gate. Together, reach the kingdom’s defence target by the end, or everyone loses most of their points.',
      'Everyone has a rank on the social ladder. Rank pays every round: Crown 100, Nobles 60, Guild 35, Commons 15.',
      'In COURT, send secret messages (the TV only shows who talks to whom). Anyone can call a COUP: 60% YES and they are King.',
      'At JUDGEMENT the King summons someone to KILL, DEMOTE or REVEAL their messages. Everyone votes. Deals for votes are binding!',
      'Killed players become ghosts: half-strength missions, no rank, and they can haunt whoever voted to kill them.',
      'Some players have a secret role: Assassin, Spy, Ghoul, Fortune Teller or Turncloak. Most points at the end wins.',
    ],
    // Recorded clips in onFx; synth sounds here.
    fx: { start: 'start', round: 'swell', mission: 'drum', repelled: 'chime', breached: 'shatter', court: 'creak', msg: 'click', assassinated: 'stab', foiled: 'gasp', coupCall: 'sting', coup: 'drum', voted: 'ballot', crowned: 'reveal', coupFail: 'boo', trial: 'heartbeat', executed: 'kill', spared: 'saved', summon: 'creak', gavel: 'gavel', offer: 'flip', deal: 'deal', passed: 'gavel', acquitted: 'chime', mercy: 'chime', pay: 'chime', ghost: 'wail', haunt: 'groan', ghoul: 'groan', survive: 'win', fall: 'explosion', unmask: 'reveal', win: 'win' },
    onFx(f) {
      if (f.kind === 'round' || f.kind === 'mission') clip('horn.ogg', { vol: 0.28 });
      else if (f.kind === 'crowned') clip('fanfare.ogg', { vol: 0.35 });
      else if (f.kind === 'gavel' || f.kind === 'passed') clip('gavel.ogg', { vol: 0.35 });
      else if (f.kind === 'court' || f.kind === 'summon') clip('gate.ogg', { vol: 0.22 });
      else if (f.kind === 'ghost') clip('whoosh.ogg', { vol: 0.32 });
      else if (f.kind === 'peal') clip('bell.ogg', { vol: Math.min(0.4, 0.1 + 0.05 * (f.k || 1)), gap: 300 });
      else if (f.kind === 'assassinated') clip('stab.ogg', { vol: 0.35 });
    },
    music: (s) => (s.phase === 'brief' || s.phase === 'mission' ? 'play' : s.phase === 'court' || s.phase === 'pay' || s.phase === 'repel' ? 'think'
      : ['dusk', 'coup', 'coupResult', 'trial', 'trialResult', 'summon', 'hearing', 'verdict'].includes(s.phase) ? 'tense' : s.phase === 'siege' || s.phase === 'unmask' ? 'reveal' : s.phase === 'over' ? 'finale' : undefined),
    lobbyTv, tv, phone,
  };
})();
