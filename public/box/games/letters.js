'use strict';
// Letter Rush screens, dressed as the title screen's desk at night: cream letter tiles, a big
// red letter die, a yellow legal pad with red margin and blue rules, handwriting (Caveat Brush)
// and chunky Bungee headings. TV: the lobby (the settings are lines on the pad, players are
// tiles on a rack), the roll (the die tumbles and lands, the list slides in), the writing
// race (pencils filling up), the review one category at a time (matches stamped, unique
// answers scored, challenged ones put on trial), the round tally and the awards. Phone: a
// fast answer sheet (Enter jumps to the next line), challenges, the vote.
(function () {
  const { esc, timer } = BOX;
  // Phone state that survives re-renders (rendering pauses while an input is focused).
  let drafts = [], sent = [], draftKey = '', saveT = 0, flushT = 0, endT = 0, deadline = 0, lobbyErr = '';
  const seen = new Set();
  const once = (k) => { if (seen.has(k)) return false; seen.add(k); if (seen.size > 400) seen.clear(); return true; };
  const hash = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.codePointAt(0)) >>> 0; return h; };
  const tilt = (k, amp = 2) => (((hash(k) % 100) / 100) * 2 - 1) * amp;
  const TINT = ['#fff3a3', '#ffd6e0', '#c9f2e8', '#d9e8ff', '#ffe2b8', '#e8dcff'];
  const tint = (k) => TINT[hash(k) % TINT.length];
  const nm = (o) => (o ? (o.av ? esc(o.av) + ' ' : '') + esc(o.name) : '');
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const ABC = 'ABCDEFGHIJKLMNOPRSTUVWY';
  const ROUND = {
    normal: { icon: '📝', name: 'Classic round', blurb: 'One letter. Fill the list.' },
    speed: { icon: '⚡', name: 'Speed round', blurb: 'Fewer categories, less time. Go go go!' },
    theme: { icon: '🎯', name: 'Theme round', blurb: 'Every category from one theme.' },
    double: { icon: '✌️', name: 'Double Letter', blurb: 'Two letters: start with either. Double points!' },
  };
  const rtype = (s) => ROUND[s.type] || ROUND.normal;
  const tile = (L, cls = '') => `<b class="lr-tile ${cls}">${esc(L)}</b>`;
  const tiles = (str, cls = '') => [...String(str)].map((c) => (c === ' ' ? '<i class="lr-gap"></i>' : tile(c, cls))).join('');
  const lettersLine = (ls) => ls.map((L) => tile(L, 'sm')).join('<span class="lr-or">or</span>');
  // The letter die: six faces, the front one is the rolled letter.
  const die = (L, key, i = 0) => {
    const r = hash(key + i), f = (k) => ABC[(r + k * 7) % ABC.length];
    return `<div class="lr-die" id="lrd-${esc(key)}-${i}" style="--dd:${(i * 0.35).toFixed(2)}s"><div class="lr-cube">
      <b class="f1">${esc(L)}</b><b class="f2">${f(1)}</b><b class="f3">${f(2)}</b><b class="f4">${f(3)}</b><b class="f5">${f(4)}</b><b class="f6">${f(5)}</b></div><i class="lr-shadow"></i></div>`;
  };
  const pts = (x, mult) => (x.status === 'ok' ? `+${x.pts}` : '0');

  // ---------- TV lobby: a legal pad of settings, players as tiles on a rack ----------
  function lobbyTv(el, L) {
    const n = L.players.length, need = Math.max(0, L.min - n), F = L.fields || [];
    const lines = F.map((f, i) => {
      const cur = f.options.find((o) => String(o.value) === String(L.settings[f.key])) || f.options[0];
      return `<div role="button" tabindex="0" class="lr-set" data-cycle="${esc(f.key)}" style="--d:${(i * 0.08).toFixed(2)}s">
        <span class="lr-setn">${i + 1}.</span><span class="lr-setl">${esc(f.label)}</span><span class="lr-dots"></span><span class="lr-setv" id="lrv-${esc(f.key)}-${esc(String(cur.value))}">${esc(cur.label)}</span>
        <select data-set="${esc(f.key)}" tabindex="-1" aria-label="${esc(f.label)}">${f.options.map((o) => `<option value="${esc(String(o.value))}" ${String(L.settings[f.key]) === String(o.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></div>`;
    }).join('');
    const five = Number(L.settings.rounds) === 5;
    const plan = (five ? ['normal', 'speed', 'theme', 'normal', 'double'] : ['normal', 'mystery', 'double']).map((t, i) => {
      const R = t === 'mystery' ? { icon: '❓', name: 'Speed or Theme' } : ROUND[t];
      return `<span class="lr-planr"><small>${i === (five ? 4 : 2) ? 'Final' : 'Round ' + (i + 1)}</small>${R.icon} ${esc(R.name)}</span>`;
    }).join('');
    const shown = L.players.slice(0, 20);
    BOX.morph(el, `<div class="lr lr-lobby">
      <section class="lr-joinc">
        <div class="lr-logo">${tiles('LETTER', 'lg')}<div class="lr-rush">RUSH!</div></div>
        <div class="lr-qrwrap"><img id="qr" alt="QR code to join" src="${esc(L.qr)}"></div>
        <div class="lr-codel">Room code</div>
        <div class="lr-code" id="code">${[...String(L.code)].map((c) => `<span class="lr-tile">${esc(c)}</span>`).join('')}</div>
        <div class="lr-url">${esc(L.joinUrl.replace(/^https?:\/\//, ''))}</div>
        <div class="lr-vip">${L.vip ? `👑 <b>${esc(L.vip)}</b> is the host` : 'The first to join is the host 👑'}</div>
      </section>
      <section class="lr-padwrap">
        <div class="lr-pad lr-lpad"><div class="lr-padtop"><span>Tonight’s list</span><i class="lr-pencil"></i></div>
          <div class="lr-padbody">
            <p class="lr-tag">A letter is rolled. Fill every category with a word that starts with it. <b>Match someone and it scores nothing!</b></p>
            <div class="lr-sets" id="settings">${lines}</div>
            <div class="lr-plan">${plan}</div>
          </div></div>
        <div class="lr-go"><button class="lr-start" id="start" ${need ? 'disabled' : ''}>🎲 Roll the first letter</button>
          <div class="lr-err" id="lobby-err">${esc(lobbyErr)}</div>
          <div class="lr-need">${need ? `Need ${need} more player${need === 1 ? '' : 's'}` : `${plural(n, 'player')} in · best with 3–10 · the host can start from their phone`}</div>
          <div class="lr-links"><button class="lr-link" id="add-bots">+ add 5 test bots</button><button class="lr-link" id="rm-bots">remove bots</button><button class="lr-link" id="tv-switch">🎮 other game</button></div></div>
      </section>
      <section class="lr-rackbar"><div class="lr-rackl">Players <b>${n}</b></div>
        <div class="lr-rack" id="roster">${shown.map((p, i) => `<span class="chip lr-chip ${p.online ? '' : 'off'}" id="lrc-${esc(p.id)}" data-kick="${esc(p.id)}" title="Click to remove" style="--tl:${tilt(p.id, 4).toFixed(1)}deg;--d:${(i % 10) * 0.05}s"><b>${esc(p.avatar || '🙂')}</b><span>${esc(p.name)}</span></span>`).join('') || '<div class="lr-empty">The rack is empty… scan the code to grab a tile!</div>'}${n > shown.length ? `<span class="lr-more">+${n - shown.length}</span>` : ''}</div>
        ${L.lineupHtml ? `<div class="lr-party">${L.lineupHtml}</div>` : ''}</section>
    </div>`);
    for (const s of el.querySelectorAll('select[data-set]')) { s.onchange = () => L.set(s.dataset.set, s.value); s.onclick = (e) => e.stopPropagation(); }
    for (const b of el.querySelectorAll('[data-cycle]')) b.onclick = () => { const s = b.querySelector('select'); s.selectedIndex = (s.selectedIndex + 1) % s.options.length; BOX.sfx('pop'); s.onchange(); };
    el.querySelector('#start').onclick = async () => { const r = await L.start(); lobbyErr = r && !r.ok ? r.error || 'Could not start.' : ''; const e = el.querySelector('#lobby-err'); if (e) e.textContent = lobbyErr; };
    el.querySelector('#add-bots').onclick = () => L.bots(5);
    el.querySelector('#rm-bots').onclick = () => L.removeBots();
    el.querySelector('#tv-switch').onclick = () => L.pick();
    for (const c of el.querySelectorAll('[data-kick]')) c.onclick = () => { if (confirm('Remove this player?')) L.kick(c.dataset.kick); };
  }

  // ---------- TV ----------
  const tally = (list, title = 'Tally') => `<aside class="lr-tally"><h3>${esc(title)}</h3><div class="lr-rows">${(list || []).map((r, i) => `<div class="lr-trow ${i === 0 && r.points > 0 ? 'lead' : ''}"><span class="lr-rk">${i + 1}</span><span class="lr-av">${esc(r.av || '🙂')}</span><span class="lr-nm">${esc(r.name)}${r.streak >= 3 ? ` <small class="lr-fire">🔥${r.streak}</small>` : ''}</span><b>${r.points}</b></div>`).join('')}</div></aside>`;
  const roundPill = (s) => `<span class="lr-pill t-${esc(s.type)}">${rtype(s).icon} ${esc(rtype(s).name)}${s.theme ? `: ${esc(s.theme.icon)} ${esc(s.theme.name)}` : ''}</span>`;
  const header = (s) => `<header class="lr-top"><span class="lr-pill">Round ${s.round} of ${s.rounds}</span>${roundPill(s)}${s.mult > 1 ? '<span class="lr-pill gold">×2 points</span>' : ''}${s.endsIn ? `<span class="lr-pill clock">⏱ ${timer(s.endsIn)}</span>` : ''}</header>`;
  function pad(s, key, cls = '') {
    return `<div class="lr-pad lr-list ${cls}" id="lrp-${esc(key)}"><div class="lr-padtop"><span>${s.theme ? `${esc(s.theme.icon)} ${esc(s.theme.name)}` : `Starts with ${s.letters.map(esc).join(' or ')}`}</span><i class="lr-pencil"></i></div>
      <ol class="lr-cats n${s.cats.length}">${s.cats.map((c, i) => `<li style="--i:${i}"><span class="lr-num">${i + 1}</span><span class="lr-ct">${esc(c)}</span></li>`).join('')}</ol></div>`;
  }
  function tvRollWrite(s) {
    const key = `${s.round}-${s.letters.join('')}`, R = rtype(s), rolling = s.phase === 'roll';
    const prog = (s.progress || []).map((p) => {
      const pct = Math.round((p.filled / Math.max(1, s.cats.length)) * 100);
      return `<div class="lr-pp ${p.done ? 'done' : ''}" id="lrpp-${esc(p.id)}"><span class="lr-ppav">${esc(p.av || '🙂')}</span><span class="lr-ppn">${esc(p.name)}</span><span class="lr-bar"><i style="width:${pct}%"></i></span><span class="lr-ppc">${p.done ? '✓' : `${p.filled}/${s.cats.length}`}</span></div>`;
    }).join('');
    const left = `<div class="lr-diecol">
        <div class="lr-rtype t-${esc(s.type)}" id="lrt-${key}"><div class="lr-rti">${R.icon}</div><div><div class="lr-rtn">${esc(R.name)}</div><div class="lr-rtb">${esc(R.blurb)}</div></div></div>
        <div class="lr-dice n${s.letters.length}">${s.letters.map((L, i) => die(L, key, i)).join('')}</div>
        <div class="lr-yl" id="lry-${key}">${s.letters.length > 1 ? 'Start with' : 'Your letter is'} ${s.letters.map((L) => `<b>${esc(L)}</b>`).join(' or ')}</div>
        ${rolling ? '' : `<div class="lr-bigclock">${timer(s.endsIn)}</div><div class="lr-status">📱 Write on your phone · <b>${s.done || 0}</b> / ${s.of || 0} done</div>`}
        ${s.first ? `<div class="lr-first" id="lrf-${key}">⚡ ${nm(s.first)} finished first!</div>` : ''}
      </div>`;
    return `<div class="lr lr-tv lr-rw" data-phase="${esc(s.phase)}"><section class="lr-main">${header(s)}
      <div class="lr-rwgrid">${left}<div class="lr-padcol">${pad(s, key, rolling ? 'arrive' : '')}</div></div>
      ${prog ? `<div class="lr-progress">${prog}${s.more ? `<span class="lr-more">+${s.more}</span>` : ''}</div>` : ''}</section></div>`;
  }
  function card(x, s, o = {}) {
    const st = x.status, badge = st === 'ok' ? `<span class="lr-pts ${x.bonus ? 'bonus' : ''}">+${x.pts}${x.bonus ? ' ✨' : ''}</span>` : st === 'struck' ? '<span class="lr-pts zero">0</span>' : '';
    return `<div class="lr-card s-${esc(st)} ${x.ch ? 'chal' : ''} ${o.big ? 'big' : ''}" id="lrk-${esc(o.key)}-${esc(x.id)}" style="--bg:${tint(x.text)};--tl:${tilt(x.id + x.text, 2.4).toFixed(1)}deg;--d:${((o.i || 0) * 0.05).toFixed(2)}s">
      <div class="lr-ans">${esc(x.text)}</div><div class="lr-by">${nm(x)}</div>${badge}
      ${x.bonus && st === 'ok' ? '<span class="lr-allit">alliteration!</span>' : ''}
      ${x.ch ? `<span class="lr-thumb">👎${x.ch > 1 ? ' ' + x.ch : ''}</span>` : ''}
      ${st === 'struck' ? '<span class="lr-stamp no">STRUCK</span>' : o.kept ? '<span class="lr-stamp yes">COUNTS</span>' : ''}
      ${o.tally ? `<div class="lr-votes"><span class="y">✓ ${x.tally ? x.tally.yes : ''}</span><span class="n">✗ ${x.tally ? x.tally.no : ''}</span></div>` : ''}</div>`;
  }
  function group(g, s, key, i) {
    if (!g.shared) return card(g.items[0], s, { key, i });
    return `<div class="lr-card lr-meld" id="lrm-${esc(key)}-${i}" style="--tl:${tilt(g.text + i, 2).toFixed(1)}deg;--d:${(i * 0.05).toFixed(2)}s">
      <div class="lr-ans">${esc(g.text)}</div><div class="lr-meldw">${g.items.map((x) => `<span>${esc(x.av || '🙂')} ${esc(x.name)}</span>`).join('')}${g.more ? `<span>+${g.more}</span>` : ''}</div>
      <span class="lr-stamp meld">🧠 MATCH ×${g.n}</span><span class="lr-pts zero">0</span></div>`;
  }
  function tvReview(s) {
    const r = s.rev, key = `${s.round}-${r.ci}`;
    const catHead = `<div class="lr-cathead" id="lrh-${key}"><div class="lr-catn">${r.ci + 1}<small>/${r.of}</small></div><div class="lr-catt">${esc(r.cat)}</div><div class="lr-catl">${lettersLine(s.letters)}</div></div>`;
    let body = '', status = '';
    if (s.phase === 'review') {
      const melds = r.groups.filter((g) => g.shared), uniq = r.groups.filter((g) => !g.shared);
      body = `<div class="lr-board ${r.groups.length > 14 ? 'dense' : ''}">${uniq.map((g, i) => group(g, s, key, i)).join('')}${melds.map((g, i) => group(g, s, key, 100 + i)).join('')}
        ${r.more ? `<div class="lr-morec">+${r.more} more answers</div>` : ''}${!r.groups.length ? '<div class="lr-none">Nobody had one! ✏️</div>' : ''}</div>
        ${r.bad.length ? `<div class="lr-bad">${r.bad.map((x) => `<span>✗ <s>${esc(x.text)}</s> <small>${esc(x.name)} · ${x.status === 'repeat' ? 'used twice' : 'wrong letter'}</small></span>`).join('')}${r.badMore ? `<span>+${r.badMore}</span>` : ''}</div>` : ''}`;
      status = `<div class="lr-status">👎 Something fishy? Challenge it on your phone · 👍 <b>${r.ready}</b> ready</div>`;
    } else {
      const done = s.phase === 'verdict';
      body = `<div class="lr-trial"><h2 class="lr-trialh">${done ? (r.verdict && r.verdict.struck ? '⚖️ The room has spoken!' : '⚖️ Everything stands!') : '⚖️ On trial: does it count?'}</h2>
        <div class="lr-board trial">${r.trial.map((x, i) => card(x, s, { key: key + (done ? 'v' : 't'), i, big: true, tally: done, kept: done && x.status === 'ok' })).join('')}</div></div>`;
      status = done ? '' : '<div class="lr-status">🗳️ Vote on your phone: ✓ counts or ✗ doesn’t</div>';
    }
    const fires = r.fires && r.fires.length ? `<div class="lr-fires">🔥 Streak bonus +1: ${r.fires.map(esc).join(', ')}</div>` : '';
    return `<div class="lr lr-tv lr-rev" data-phase="${esc(s.phase)}"><section class="lr-main">${header(s)}${catHead}<div class="lr-stage">${body}</div>${status}${fires}</section>${tally(s.standings)}</div>`;
  }
  function tvScores(s) {
    const g = s.gains || [], top = Math.max(1, ...g.map((r) => r.gain)), nextT = s.plan[s.round];
    const N = nextT ? ROUND[nextT] : null;
    return `<div class="lr lr-tv lr-sc" data-phase="scores"><section class="lr-main">${header(s)}
      <div class="lr-pad lr-scpad" id="lrs-${s.round}"><div class="lr-padtop"><span>Round ${s.round} points</span><i class="lr-pencil"></i></div>
        <div class="lr-gains">${g.map((r, i) => `<div class="lr-gain" style="--i:${i};--w:${Math.round((r.gain / top) * 100)}%"><span class="lr-av">${esc(r.av || '🙂')}</span><span class="lr-nm">${esc(r.name)}</span><span class="lr-gbar"><i></i></span><b>+${r.gain}</b></div>`).join('') || '<p class="lr-none">A tough round! Nobody scored.</p>'}</div></div>
      ${N ? `<div class="lr-next" id="lrn-${s.round}">Next up: <b>${N.icon} ${esc(N.name)}</b> <small>${esc(N.blurb)}</small></div>` : '<div class="lr-next">Final scores coming up…</div>'}
    </section>${tally(s.standings)}</div>`;
  }
  function tvOver(s) {
    const w = s.standings[0], h = s.highlights || {};
    const awards = (s.awards || []).map((x, i) => `<div class="lr-award" style="--d:${(0.8 + i * 0.25).toFixed(2)}s;--tl:${tilt(x.title, 3).toFixed(1)}deg"><div class="ic">${x.icon}</div><div class="t">${esc(x.title)}</div><div class="n">${nm(x)}</div><div class="v">${esc(x.value)}</div></div>`).join('');
    const hl = [h.allit ? ['✨ Best alliteration', h.allit.text, `${nm(h.allit)} · ${esc(h.allit.cat)}`] : null, h.meld ? ['🧠 Biggest mind meld', h.meld.text, `${h.meld.n} people · ${esc(h.meld.cat)}`] : null]
      .filter(Boolean).map(([t, a, b]) => `<div class="lr-hl"><div class="lr-hlt">${t}</div><div class="lr-hla">“${esc(a)}”</div><div class="lr-hlb">${b}</div></div>`).join('');
    return `<div class="lr lr-tv lr-over" data-phase="over"><section class="lr-main">
      <div class="lr-champ"><div class="lr-champl">Letter Rush champion</div><div class="lr-champn">${w ? tiles(String(w.name).toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, 12) || '?', 'win') : ''}</div>
        ${w ? `<div class="lr-champp">${esc(w.av || '')} ${esc(w.name)} · <b>${w.points} pts</b></div>` : ''}</div>
      ${hl ? `<div class="lr-hls">${hl}</div>` : ''}${awards ? `<div class="lr-awards">${awards}</div>` : ''}
    </section>${tally(s.standings, 'Final tally')}</div>`;
  }
  function tv(el, s) {
    if (!s) return;
    let html;
    if (s.phase === 'over') html = tvOver(s);
    else if (s.phase === 'roll' || s.phase === 'write') html = tvRollWrite(s);
    else if (s.rev) html = tvReview(s);
    else if (s.phase === 'scores') html = tvScores(s);
    else html = '<div class="lr lr-tv"></div>';
    BOX.morph(el, html);
  }

  // ---------- phone ----------
  function save(ctx, i) {
    if (Date.now() > deadline + 400 || drafts[i] === sent[i]) return;
    sent[i] = drafts[i]; ctx.act({ op: 'ans', i, text: drafts[i] || '' });
  }
  function flushAll(ctx, done) {
    clearTimeout(saveT);
    const changed = drafts.some((t, i) => t !== sent[i]);
    if (!changed && done == null) return Promise.resolve({ ok: true });
    sent = drafts.slice();
    return ctx.act(done == null ? { op: 'sheet', answers: drafts } : { op: 'sheet', answers: drafts, done: done === true });
  }
  const startsOk = (t, ls) => {
    const w = String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/['’`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
    if (!w.length) return null;
    const ok = (x) => ls.some((L) => x[0] === L.toLowerCase());
    return ok(w[0]) || (['the', 'a', 'an'].includes(w[0]) && w.length > 1 && ok(w[1]));
  };
  function phoneWrite(el, v, ctx) {
    const k = `${v.round}|${v.letters.join('')}|${v.cats.join('|')}`;
    if (draftKey !== k) { draftKey = k; drafts = (v.mine || []).slice(); sent = drafts.slice(); }
    while (drafts.length < v.cats.length) { drafts.push(''); sent.push(''); }
    // Pencils down: un-focus at the deadline so the screen can move on, saving everything first.
    deadline = Date.now() + (v.endsIn || 0);
    clearTimeout(flushT); clearTimeout(endT);
    if (v.endsIn > 1500) flushT = setTimeout(() => flushAll(ctx), v.endsIn - 1100);
    endT = setTimeout(() => { const a = document.activeElement; if (a && a.closest && a.closest('.lr-sheet')) a.blur(); ctx.redraw(); }, (v.endsIn || 0) + 300);
    if (once('write:' + k)) ctx.haptic('turn');
    const filled = drafts.filter((t) => t && t.trim()).length;
    const rows = v.cats.map((c, i) => {
      const ok = startsOk(drafts[i], v.letters);
      return `<li class="lr-row ${ok == null ? '' : ok ? 'ok' : 'bad'}" data-row="${i}"><label for="lr-a${i}"><span class="lr-num">${i + 1}</span>${esc(c)}</label>
        <div class="lr-inwrap"><input id="lr-a${i}" class="lr-in" data-i="${i}" maxlength="${v.max}" value="${esc(drafts[i] || '')}" placeholder="${esc(v.letters[0])}…" autocomplete="off" autocapitalize="words" spellcheck="false" enterkeyhint="${i === v.cats.length - 1 ? 'done' : 'next'}"><span class="lr-mark"></span></div></li>`;
    }).join('');
    BOX.morph(el, `<div class="lr lr-ph" data-phase="write">
      <div class="lr-shead"><div class="lr-sletters">${v.letters.map((L) => tile(L)).join('')}</div>
        <div class="lr-sinfo"><b>${esc(rtype(v).icon)} ${esc(rtype(v).name)}</b><small>${v.letters.length > 1 ? `Start with ${v.letters.map(esc).join(' or ')} · ×2 points` : `Everything starts with ${esc(v.letters[0])}`}${v.theme ? ` · ${esc(v.theme.name)}` : ''}</small></div>
        <div class="lr-sclock">${timer(v.endsIn)}</div></div>
      <ol class="lr-sheet" id="lr-sheet-${esc(String(v.round))}">${rows}</ol>
      <div class="lr-sfoot"><span class="lr-filled" id="lr-filled">${filled}/${v.cats.length}</span>
        <button class="lr-btn ${v.done ? 'ghost' : 'go'}" id="lr-done">${v.done ? '✏️ Still editing' : '✓ I’m done'}</button></div>
      ${v.done ? '<p class="lr-hint">✅ Sent! You can still fix answers until time runs out.</p>' : '<p class="lr-hint">Tip: <b>Enter</b> jumps to the next line. Match someone and you both score 0!</p>'}</div>`);
    const ins = [...el.querySelectorAll('.lr-in')];
    const count = () => { const f = el.querySelector('#lr-filled'); if (f) f.textContent = `${drafts.filter((t) => t && t.trim()).length}/${v.cats.length}`; };
    for (const inp of ins) {
      const i = Number(inp.dataset.i), row = inp.closest('.lr-row');
      inp.oninput = () => {
        drafts[i] = inp.value; const ok = startsOk(inp.value, v.letters);
        row.classList.toggle('ok', ok === true); row.classList.toggle('bad', ok === false); count();
        clearTimeout(saveT); saveT = setTimeout(() => save(ctx, i), 700);
      };
      inp.onkeydown = (e) => {
        if (e.key !== 'Enter') return; e.preventDefault(); save(ctx, i); ctx.haptic('tap');
        const nx = ins[i + 1]; if (nx) { nx.focus(); nx.scrollIntoView({ block: 'center', behavior: 'smooth' }); } else inp.blur();
      };
      inp.onblur = () => { save(ctx, i); setTimeout(() => { if (!el.contains(document.activeElement) || !document.activeElement.classList.contains('lr-in')) ctx.redraw(); }, 60); };
    }
    el.querySelector('#lr-done').onclick = async () => {
      const r = await flushAll(ctx, !v.done);
      if (r && r.ok) { ctx.haptic(v.done ? 'tap' : 'success'); if (!v.done) ctx.sfx('chime'); }
    };
  }
  function statusLine(x, v) {
    if (!x) return { cls: 'blank', h: '— You left this one blank', p: '' };
    if (x.status === 'ok') return { cls: x.bonus ? 'bonus' : 'ok', h: x.bonus ? `✨ Alliteration! +${x.pts}` : `✓ Unique! +${x.pts}`, p: '' };
    if (x.status === 'shared') return { cls: 'meld', h: '🧠 Mind meld: 0 points', p: v.rev.meld.length ? `Same as ${v.rev.meld.map(esc).join(', ')}` : '' };
    if (x.status === 'wrong') return { cls: 'bad', h: `✗ Doesn’t start with ${v.letters.map(esc).join(' or ')}`, p: '' };
    if (x.status === 'repeat') return { cls: 'bad', h: '↺ You used that one already', p: '' };
    if (x.status === 'struck') return { cls: 'bad', h: '⚖️ Struck by the room: 0', p: '' };
    return { cls: '', h: '', p: '' };
  }
  function phone(el, v, ctx) {
    if (!v) return;
    if (v.phase !== 'write') { clearTimeout(flushT); clearTimeout(endT); }
    const head = `<div class="lr-me"><span class="lr-mypts">${v.points} pts <small>#${v.rank || '-'}</small></span>${v.streak >= 2 ? `<span class="lr-streak">🔥 ${v.streak} in a row</span>` : ''}<span class="lr-rnd">Round ${v.round}/${v.rounds}</span></div>`;
    const wrap = (phase, html) => `<div class="lr lr-ph" data-phase="${phase}">${head}${html}</div>`;
    if (v.phase === 'over') {
      const st = v.stats || {};
      BOX.morph(el, `<div class="lr lr-ph" data-phase="over"><div class="lr-pcard lr-c"><div class="lr-rank">${tile('#' + v.rank, 'lg')}</div><h3>${v.rank === 1 ? 'Champion of the alphabet!' : 'Pencils down!'}</h3><p class="lr-big">${v.points} points</p>
        ${(v.awards || []).map((a) => `<div class="lr-myaward">${a.icon} <b>${esc(a.title)}</b><small>${esc(a.value)}</small></div>`).join('')}
        <div class="lr-stats"><span>🦄 ${st.unique} unique</span><span>✨ ${st.allit} alliterations</span><span>🧠 ${st.shared} matched</span><span>🔥 best streak ${st.best}</span></div></div>
        <div class="lr-pcard">${(v.final || []).map((r, i) => `<div class="lr-trow ${i === 0 ? 'lead' : ''}"><span class="lr-rk">${i + 1}</span><span class="lr-av">${esc(r.av || '🙂')}</span><span class="lr-nm">${esc(r.name)}</span><b>${r.points}</b></div>`).join('')}</div></div>`);
      if (once('over:' + v.rank)) ctx.haptic(v.rank === 1 ? 'win' : 'big');
      return;
    }
    if (v.phase === 'roll') {
      const key = `${v.round}-${v.letters.join('')}`;
      if (once('roll:' + key)) { ctx.haptic('big'); setTimeout(() => ctx.haptic('turn'), 2600); }
      BOX.morph(el, wrap('roll', `<div class="lr-pcard lr-c lr-proll"><div class="lr-rti">${rtype(v).icon}</div><h3>${esc(rtype(v).name)}${v.theme ? `: ${esc(v.theme.icon)} ${esc(v.theme.name)}` : ''}</h3><p class="lr-muted">${esc(rtype(v).blurb)}</p>
        <div class="lr-dice ph n${v.letters.length}">${v.letters.map((L, i) => die(L, 'p' + key, i)).join('')}</div>
        <p class="lr-get">✍️ ${v.cats.length} categories coming… thumbs ready!</p></div>`));
      return;
    }
    if (v.phase === 'write') return phoneWrite(el, v, ctx);
    if (v.rev && v.phase === 'review') {
      const r = v.rev, key = `${v.round}-${r.ci}`, s = statusLine(r.mine, v);
      if (once('rev:' + key) && r.mine) ctx.haptic(r.mine.status === 'ok' ? 'success' : r.mine.status === 'shared' ? 'buzz' : 'error');
      const list = r.others.map((x) => `<div class="lr-orow ${x.mine ? 'on' : ''}"><div><b>${esc(x.text)}</b><small>${esc(x.av || '')} ${esc(x.name)}${x.bonus ? ' · ✨' : ''}</small></div><button class="lr-chal ${x.mine ? 'on' : ''}" data-ch="${esc(x.id)}" data-on="${x.mine ? '0' : '1'}">👎${x.mine ? ' Challenged' : ''}</button></div>`).join('');
      BOX.morph(el, wrap('review', `<div class="lr-pcat"><span class="lr-num">${r.ci + 1}/${r.of}</span>${esc(r.cat)}</div>
        <div class="lr-mine s-${s.cls}"><div class="lr-ml">your answer</div><div class="lr-mt">${r.mine ? esc(r.mine.text) : '—'}</div><div class="lr-mh">${s.h}</div>${s.p ? `<small>${s.p}</small>` : ''}</div>
        ${list ? `<div class="lr-pcard"><h4>Anything fishy? Tap 👎 to challenge</h4>${list}</div>` : ''}
        <button class="lr-btn ${r.ready ? 'ghost' : 'go'} big" id="lr-ready" ${r.ready ? 'disabled' : ''}>${r.ready ? '👍 Waiting for the others…' : '👍 Looks good, next!'}</button>`));
      for (const b of el.querySelectorAll('[data-ch]')) b.onclick = async () => { const on = b.dataset.on === '1'; const res = await ctx.act({ op: 'challenge', id: b.dataset.ch, on }); if (res.ok) { ctx.haptic(on ? 'warn' : 'tap'); if (on) ctx.sfx('pop'); } };
      const rb = el.querySelector('#lr-ready'); if (rb) rb.onclick = async () => { rb.disabled = true; const res = await ctx.act({ op: 'ready' }); if (res.ok) ctx.haptic('tap'); };
      return;
    }
    if (v.rev && v.phase === 'vote') {
      const r = v.rev;
      const items = r.trial.map((x) => x.own
        ? `<div class="lr-vcard own"><div class="lr-vt">“${esc(x.text)}”</div><small>That’s yours! 😬 The room is deciding…</small></div>`
        : `<div class="lr-vcard"><div class="lr-vt">“${esc(x.text)}”</div><small>${esc(x.av || '')} ${esc(x.name)} · 👎 ${x.ch}</small>
          <div class="lr-vbtns"><button class="lr-vb yes ${x.vote === true ? 'on' : ''}" data-v="${esc(x.id)}" data-k="1">✓ Counts</button><button class="lr-vb no ${x.vote === false ? 'on' : ''}" data-v="${esc(x.id)}" data-k="0">✗ Nope</button></div></div>`).join('');
      if (once('vote:' + v.round + ':' + r.ci)) ctx.haptic(r.trial.some((x) => x.own) ? 'warn' : 'turn');
      BOX.morph(el, wrap('vote', `<div class="lr-pcat"><span class="lr-num">${r.ci + 1}/${r.of}</span>${esc(r.cat)}</div><h3 class="lr-c">⚖️ Does it count? ${timer(v.endsIn)}</h3><p class="lr-muted lr-c">Must start with ${v.letters.map(esc).join(' or ')} and fit the category.</p>${items}`));
      for (const b of el.querySelectorAll('[data-v]')) b.onclick = async () => { const res = await ctx.act({ op: 'vote', id: b.dataset.v, keep: b.dataset.k === '1' }); if (res.ok) { ctx.haptic('select'); ctx.sfx('click'); } };
      return;
    }
    if (v.rev && v.phase === 'verdict') {
      const r = v.rev, own = r.trial.find((x) => x.own);
      if (once('verdict:' + v.round + ':' + r.ci)) ctx.haptic(own ? (own.status === 'struck' ? 'error' : 'success') : 'tap');
      BOX.morph(el, wrap('verdict', `<div class="lr-pcat"><span class="lr-num">${r.ci + 1}/${r.of}</span>${esc(r.cat)}</div>
        ${r.trial.map((x) => `<div class="lr-vcard ${x.status === 'struck' ? 'struck' : 'kept'} ${x.own ? 'own' : ''}"><div class="lr-vt">“${esc(x.text)}”</div><small>${esc(x.name)} · ✓ ${x.tally ? x.tally.yes : 0} ✗ ${x.tally ? x.tally.no : 0}</small><span class="lr-stamp ${x.status === 'struck' ? 'no' : 'yes'}">${x.status === 'struck' ? 'STRUCK' : 'COUNTS'}</span></div>`).join('')}`));
      return;
    }
    if (v.phase === 'scores') {
      if (once('scores:' + v.round)) ctx.haptic(v.gain > 0 ? 'success' : 'tap');
      const nx = v.plan[v.round], N = nx ? ROUND[nx] : null;
      BOX.morph(el, wrap('scores', `<div class="lr-pcard lr-c"><h3>Round ${v.round} done!</h3><div class="lr-big">${v.gain > 0 ? '+' + v.gain : '0'}</div><p>You’re <b>#${v.rank}</b> of ${v.of}.</p>
        ${N ? `<p class="lr-muted">Next: ${N.icon} <b>${esc(N.name)}</b>. ${esc(N.blurb)}</p>` : '<p class="lr-muted">Final scores next…</p>'}</div>`));
      return;
    }
    BOX.morph(el, wrap('watch', '<div class="lr-pcard lr-c"><h3>👀 Watch the big screen…</h3></div>'));
  }

  BOX.games.letters = {
    // Soundtrack cue per phase (public/box/scores/letters.js); the TV turns the last 10 s of 'think' tense.
    music: (s) => ({ roll: 'reveal', write: 'think', review: 'play', vote: 'play', verdict: 'play', scores: 'reveal', over: 'finale' }[s.phase] || 'play'),
    name: 'Letter Rush', icon: '🔤',
    about: 'A letter is rolled. Race to fill a list of categories with answers that start with it. Match anyone and it scores nothing!',
    how: [
      'A letter is rolled on the big screen and a list of categories goes up.',
      'On your phone, write one answer per category that starts with that letter, before time runs out. Enter jumps to the next line.',
      'Then each category is reviewed. Unique answers score 1. Matching anyone else’s answer scores 0 (spelling, “the” and plurals don’t save you).',
      'Alliteration scores 2: two or more words starting with the letter, like “Big Blue Banana”.',
      'Something fishy? Tap 👎 to challenge it and the room votes on whether it counts. Five scoring answers in a row: 🔥 +1.',
      'Watch for Speed rounds, Theme rounds and the final Double Letter round (two letters, double points).',
    ],
    fx: { roll: 'diceRoll', go: 'bell', first: 'pop', cat: 'whoosh', challenge: 'pop', vote: 'ballot', verdict: 'gavel', streak: 'cheer', scores: 'chime', win: 'win' },
    onFx(f) {
      if (f.kind === 'roll') setTimeout(() => BOX.sfx(f.double ? 'drum' : 'pop'), 2500);
      if (f.kind === 'verdict') setTimeout(() => BOX.sfx(f.struck ? 'gasp' : 'cheer'), 500);
    },
    lobbyTv,
    lobby: () => '<div class="lr lr-phlobby"><div class="lr-pcard lr-c"><div class="lr-sletters">' + 'RUSH'.split('').map((c) => tile(c)).join('') + '</div><p>Warm up your thumbs: you’ll be typing fast!</p></div></div>',
    tv,
    phone,
  };
})();
