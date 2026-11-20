'use strict';
// Two Truths & a Lie screens, dressed as the title screen's late-night interrogation room:
// a brick wall, a swinging lamp, a suspect lineup with height lines, typed index cards,
// rubber stamps and a polygraph. TV: the case-file lobby (each setting is a piece of evidence
// pinned to the board, the players stand in the lineup), the suspects writing statements,
// the hot seat under the lamp with three statements, the staged reveal (tallies, then TRUE /
// LIE stamps), and the case-closed ending. Phone: type your statements and stamp the lie,
// vote (or lean early), see if you caught it.
(function () {
  const { esc, timer } = BOX;
  // Recorded sound effects (public/audio/sfx/truths/, credits.json there): quiet touches on the TV,
  // timed to what is on screen. false when they can't play (no audio engine yet, locked, muted file).
  const clip = (f, o) => !!(BOX.audio && BOX.audio.clip && BOX.audio.clip('truths/' + f, o));
  let draft = ['', '', ''], lie = null, editing = false, hintN = -1, lobbyErr = '';
  const once = new Set();
  const first = (k) => { if (once.has(k)) return false; once.add(k); if (once.size > 300) once.clear(); return true; };
  const face = (o, n, opt) => (BOX.face ? BOX.face(o, n, opt) : esc((o && (o.av || o.avatar)) || '🙂'));
  const nm = (o, n = 28) => (o ? face(o, n, { cls: 'tx-nmf' }) + ' ' + esc(o.name) : '');
  const N = ['A', 'B', 'C'];
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const hash = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.codePointAt(0)) >>> 0; return h; };
  const tilt = (k, amp = 2) => (((hash(k) % 100) / 100) * 2 - 1) * amp;
  // Idea starters for shy writers (all original).
  const HINTS = [
    'A food you’ve tried that most people haven’t', 'Somewhere surprising you’ve been', 'A weird job or chore you’ve done',
    'A famous person you’ve met (or nearly met)', 'An animal encounter you’ll never forget', 'A strange talent or party trick',
    'Something you were really good at as a kid', 'An injury with a silly story', 'A thing you’ve never done that everyone else has',
    'A record you hold in your family', 'A collection you have (or had)', 'The oddest thing you own',
    'A time you got lost', 'A competition you won (or badly lost)', 'Something you’re secretly scared of',
    'A song or movie you know by heart', 'A food you refuse to eat', 'The most spontaneous thing you’ve done',
    'A nickname you had growing up', 'A hobby you tried and quit', 'Something you built or made yourself',
    'A rule you got in trouble for breaking', 'A language or instrument you can (sort of) do', 'A celebrity you’ve been mistaken for',
  ];
  const hint = () => (hintN < 0 ? 'Mix the boring-but-true with the wild-but-false. Make your lie believable!' : '💡 ' + (served || HINTS)[hintN % (served || HINTS).length]);
  // A suspect in the lineup: silhouette, their avatar as the face, a numbered placard.
  // With a JustGameBox character (public/box/portrait.js) the suspect is that character, full body,
  // holding the placard; without one, the old silhouette with their emoji as the face.
  const suspect = (p, i, o = {}) => {
    const h = 0.86 + (hash(p.name) % 22) / 100, big = /\bbig\b/.test(o.cls || '');
    const fig = BOX.body && BOX.hasLook && BOX.hasLook(p) ? BOX.body(p, big ? 300 : Math.round(166 * h), o.mood ? { mood: o.mood } : {}) : '';
    return `<div class="tx-sus ${fig ? 'has-fig' : ''} ${o.cls || ''}" ${o.id ? `id="${esc(o.id)}"` : ''} style="--h:${h.toFixed(2)};--d:${(o.d || 0).toFixed(2)}s">${fig ? `<div class="tx-fig">${fig}</div>` : `<div class="tx-head"><span>${esc(p.av || p.avatar || '🙂')}</span></div><div class="tx-body"></div>`}<div class="tx-plac"><b>${o.num != null ? o.num : i + 1}</b><span>${esc(p.name)}</span></div>${o.stamp ? `<div class="tx-sstamp">${o.stamp}</div>` : ''}</div>`;
  };
  const polygraph = (wild) => `<div class="tx-poly ${wild ? 'wild' : ''}"><div class="tx-roll"><svg class="tx-trace" viewBox="0 0 1200 60" preserveAspectRatio="none"><path d="${TRACE}"/></svg></div><div class="tx-mach"><span class="tx-bulb ${wild ? 'on' : ''}">LIE</span><i></i><i></i><i></i></div></div>`;
  // One polygraph trace (two identical halves, so it can scroll forever).
  const TRACE = (() => { let d = 'M0 30'; for (let h = 0; h < 2; h++) for (let x = 0; x <= 600; x += 6) { const X = h * 600 + x, w = Math.sin(x * 0.07) * 9 + Math.sin(x * 0.19 + 1) * 5 + (x > 380 && x < 470 ? Math.sin(x * 0.9) * 18 : 0); d += ` L${X} ${(30 + w).toFixed(1)}`; } return d; })();
  const scoreboard = (list) => `<aside class="tx-score"><h3>Case board</h3><div class="tx-rows">${(list || []).map((r, i) => `<div class="tx-row ${i === 0 && r.points > 0 ? 'lead' : ''}"><span class="tx-rk">${i + 1}</span><span class="tx-av">${face(r, 32, i === 0 && r.points > 0 ? { mood: 'smirk' } : {})}</span><span class="tx-nm">${esc(r.name)}</span><b>${r.points}</b></div>`).join('')}</div></aside>`;

  // ---------- TV lobby: the case file, the evidence board and the lineup ----------
  const PINS = [[22, 18], [318, 40], [612, 12], [64, 200], [360, 218], [652, 192]];
  function lobbyTv(el, L) {
    const n = L.players.length, need = Math.max(0, L.min - n), F = (L.fields || []).slice(0, 6);
    const pins = F.map((f, i) => PINS[i % PINS.length]);
    const lines = pins.slice(1).map((p, i) => `<line x1="${pins[i][0] + 116}" y1="${pins[i][1] + 12}" x2="${p[0] + 116}" y2="${p[1] + 12}"/>`).join('') + (pins.length > 4 ? `<line x1="${pins[0][0] + 116}" y1="${pins[0][1] + 12}" x2="${pins[4][0] + 116}" y2="${pins[4][1] + 12}"/>` : '');
    const ev = F.map((f, i) => {
      const cur = f.options.find((o) => String(o.value) === String(L.settings[f.key])) || f.options[0];
      return `<div role="button" tabindex="0" class="tx-ev" data-cycle="${esc(f.key)}" style="left:${pins[i][0]}px;top:${pins[i][1]}px;--tl:${tilt(f.key, 3).toFixed(1)}deg;--i:${i}">
        <i class="tx-pin"></i><span class="tx-evn">EVIDENCE #${i + 1}</span><span class="tx-evl">${esc(f.label)}</span>
        <span class="tx-evv" id="txv-${esc(f.key)}-${esc(String(cur.value))}">${esc(cur.label)}</span><span class="tx-evh">tap to change ↻</span>
        <select data-set="${esc(f.key)}" tabindex="-1" aria-label="${esc(f.label)}">${f.options.map((o) => `<option value="${esc(String(o.value))}" ${String(L.settings[f.key]) === String(o.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></div>`;
    }).join('');
    const shown = L.players.slice(0, 14);
    BOX.morph(el, `<div class="tx tx-lobby">
      <section class="tx-folder">
        <div class="tx-ftab">CASE FILE</div>
        <div class="tx-fhead">No. <b>${esc(L.code)}</b> · <span>CONFIDENTIAL</span></div>
        <div class="tx-polaroid"><i class="tx-clip"></i><img id="qr" alt="QR code to join" src="${esc(L.qr)}"><span>EXHIBIT A · scan to join</span></div>
        <div class="tx-url">${esc(L.joinUrl.replace(/^https?:\/\//, ''))}</div>
        <div class="tx-codel">Room code</div><div class="tx-code" id="code">${esc(L.code)}</div>
        <div class="tx-vip">${L.vip ? `Lead detective: <b>${esc(L.vip)}</b> 👑` : 'First to join leads the case 👑'}</div>
        <div class="tx-go"><button class="tx-start" id="start" ${need ? 'disabled' : ''}>🔎 Open the case</button>
          <div class="tx-err" id="lobby-err">${esc(lobbyErr)}</div>
          <div class="tx-need">${need ? `Need ${need} more suspect${need === 1 ? '' : 's'} to start` : `${plural(n, 'suspect')} in custody · the host can start from their phone`}</div>
          <div class="tx-links"><button class="tx-link" id="add-bots">+ add 5 test bots</button><button class="tx-link" id="rm-bots">remove bots</button><button class="tx-link" id="tv-switch">🎮 other game</button></div></div>
      </section>
      <section class="tx-boardwrap">
        <div class="tx-logo"><span class="a">Two Truths</span> <span class="amp">&amp;</span> <span class="lie">a Lie</span></div>
        <div class="tx-tag">Three statements. One lie. Find it.</div>
        <div class="tx-board" id="settings"><svg class="tx-string" width="900" height="370">${lines}</svg>${ev}</div>
      </section>
      <section class="tx-lineup"><div class="tx-heights"></div>
        <div class="tx-lineh">THE LINEUP <b>${n}</b></div>
        <div class="tx-roster" id="roster">${shown.map((p, i) => `<span class="chip tx-chip ${p.online ? '' : 'off'}" id="txc-${esc(p.id)}" data-kick="${esc(p.id)}" title="Click to remove">${suspect(p, i, { d: 0 })}</span>`).join('') || '<div class="tx-empty">No suspects yet.<br>Scan the code to step into the lineup.</div>'}${n > shown.length ? `<span class="tx-more">+${n - shown.length}</span>` : ''}</div>
        ${L.lineupHtml ? `<div class="tx-party">${L.lineupHtml}</div>` : ''}
      </section>
    </div><div class="tx-lamp"></div>`);
    for (const s of el.querySelectorAll('select[data-set]')) { s.onchange = () => L.set(s.dataset.set, s.value); s.onclick = (e) => e.stopPropagation(); }
    for (const b of el.querySelectorAll('[data-cycle]')) b.onclick = () => { const s = b.querySelector('select'); s.selectedIndex = (s.selectedIndex + 1) % s.options.length; clip('click.ogg', { vol: 0.3 }) || BOX.sfx('flip'); s.onchange(); };
    el.querySelector('#start').onclick = async () => { const r = await L.start(); lobbyErr = r && !r.ok ? r.error || 'Could not start.' : ''; const e = el.querySelector('#lobby-err'); if (e) e.textContent = lobbyErr; };
    el.querySelector('#add-bots').onclick = () => L.bots(5);
    el.querySelector('#rm-bots').onclick = () => L.removeBots();
    el.querySelector('#tv-switch').onclick = () => L.pick();
    for (const c of el.querySelectorAll('[data-kick]')) c.onclick = () => { if (confirm('Remove this player?')) L.kick(c.dataset.kick); };
  }

  // ---------- TV ----------
  function items(c, reveal) {
    reveal = reveal && !!c.result; // the reveal needs the result (it can arrive a moment later)
    const r = c.result, voted = r ? Math.max(1, r.voted) : 1;
    return `<div class="tt-items tx-items ${reveal ? 'tx-reveal' : ''}" id="tti-${c.n}-${reveal ? 'r' : 'q'}">${c.items.map((t, i) => {
      if (!reveal) return `<div class="tt-item tx-card" style="--tl:${tilt(t, 1.2).toFixed(2)}deg;--d:${0.25 + i * 0.35}s"><span class="num">${N[i]}</span><span class="txt">${esc(t)}</span></div>`;
      const isLie = c.lie === i, tally = r.tally[i], pct = Math.round((tally / voted) * 100);
      return `<div class="tt-item tx-card ${isLie ? 'lie' : 'truth'} ${r.twist === i ? 'twist' : ''}" style="--tl:${tilt(t, 1.2).toFixed(2)}deg"><span class="tx-fill" style="--w:${pct}%"></span><span class="num">${N[i]}</span><span class="txt">${esc(t)}</span><span class="votes">${tally} vote${tally === 1 ? '' : 's'}</span><span class="stamp">${isLie ? 'LIE' : 'TRUE'}</span></div>`;
    }).join('')}</div>`;
  }

  function tvOver(el, s) {
    const w = s.standings[0], h = s.highlights || {};
    const awards = (s.awards || []).map((x, i) => `<div class="tx-award" style="--d:${1 + i * 0.3}s"><div class="tx-badge">${x.icon}</div><div class="t">${esc(x.title)}</div><div class="n">${nm(x)}</div><div class="v">${esc(x.value)}</div></div>`).join('');
    const hl = [
      h.lie ? `<div class="tx-hl lie"><div class="tx-label">Most believable lie</div><div class="q">“${esc(h.lie.text)}”</div><div class="by">${nm(h.lie)} fooled ${h.lie.fooled} of ${h.lie.of}</div><span class="tx-hst">LIE</span></div>` : '',
      h.truth ? `<div class="tx-hl truth"><div class="tx-label">Wait, that’s TRUE?!</div><div class="q">“${esc(h.truth.text)}”</div><div class="by">${nm(h.truth)} · ${h.truth.votes} of ${h.truth.of} called it a lie</div><span class="tx-hst">TRUE</span></div>` : '',
    ].join('');
    const gal = (s.gallery || []).length ? `<div class="tx-label sm">Lies we never got to</div><div class="tx-gallery">${s.gallery.map((g) => `<div class="tx-strip" style="--tl:${tilt(g.lie, 1.5).toFixed(2)}deg"><b>${nm(g)}:</b> “${esc(g.lie)}”</div>`).join('')}</div>` : '';
    BOX.morph(el, `<div class="tx tx-tv tx-over" data-phase="over"><section class="tx-overmain">
      <div class="tx-closed">CASE CLOSED</div>
      <div class="tx-mug">${w ? `<div class="tx-mugshot">${suspect(w, 0, { num: '#1', mood: 'smirk' })}</div>` : ''}<div><div class="tx-label">Master of deception</div><h2>${w ? esc(w.name) : ''}</h2>${w ? `<div class="tx-pts">${plural(w.points, 'point')}</div>` : ''}</div></div>
      ${hl ? `<div class="tx-hls">${hl}</div>` : ''}${awards ? `<div class="tx-awards">${awards}</div>` : ''}${gal}
    </section>${scoreboard(s.standings.slice(0, 10))}</div><div class="tx-lamp"></div>`);
  }

  function tv(el, s) {
    if (!s) return;
    if (s.phase === 'over') return tvOver(el, s);
    let main;
    if (s.phase === 'write') {
      const pct = s.of ? Math.round((s.written / s.of) * 100) : 0;
      main = `<div class="tx-write"><div class="tx-memo"><div class="tx-memoh">INTERROGATION ROOM 3 · STATEMENTS</div><h2>Suspects, grab your phones.</h2>
        <p>Type <b>two truths</b> and <b>one lie</b> about yourself. Make the lie believable.</p>
        <div class="tx-wbar"><span style="width:${pct}%"></span></div><div class="tx-wcount"><b>${s.written}</b> of ${s.of} statements filed ${s.endsIn ? `· ${timer(s.endsIn)}` : ''}</div></div>
        <div class="tx-wline"><div class="tx-heights"></div><div class="tx-wsus">${s.table.map((p, i) => suspect(p, i, { cls: p.done ? 'lit' : 'dim', id: `txw-${p.name}-${p.done ? 1 : 0}`, stamp: p.done ? 'FILED' : '' })).join('')}${s.tableMore ? `<span class="tx-more">+${s.tableMore}</span>` : ''}</div></div>
        <p class="tx-note">${s.featured < s.of ? `${s.featured} suspects will take the hot seat. The rest of the lies come out at the end.` : 'Every suspect takes a turn in the hot seat.'}</p></div>`;
    } else {
      const c = s.seat;
      if (!c) main = '<div class="tx-write"><div class="tx-memo"><h2>Bring in the next suspect…</h2></div></div>';
      else {
        let status;
        if (s.phase === 'talk') status = `<div class="tx-status">🗣️ Grill <b>${esc(c.name)}</b>! Ask questions out loud. Voting opens in ${timer(s.endsIn)}${c.voted ? ` <span class="tx-lean">${c.voted} already leaning</span>` : ''}</div>`;
        else if (s.phase === 'vote') status = `<div class="tx-status">🗳️ Which one is the lie? <b>${c.voted}</b> / ${c.of} voted · ${timer(s.endsIn)}${c.notVoted.length && c.voted ? `<small>Waiting on: ${c.notVoted.map(esc).join(', ')}</small>` : ''}</div>`;
        else if (!c.result) status = `<div class="tx-status">🔎 Here come the statements from <b>${esc(c.name)}</b>…</div>`;
        else {
          const r = c.result;
          status = `<div class="tx-status tx-verdict" id="ttv-${c.n}">${r.voted === 0 ? `Nobody voted! The lie was ${N[c.lie]}.` : r.twist != null ? `😱 Plot twist! ${N[r.twist]} is TRUE. ${esc(c.name)} fooled ${r.fooled}!` : r.fooled > r.right ? `😈 ${esc(c.name)} fooled ${r.fooled}! +${Math.min(r.fooled, 5)}` : `🕵️ ${plural(r.right, 'detective')} spotted the lie!`}
            ${r.first.length ? `<small>✅ Got it: ${r.first.map(esc).join(', ')}${r.right > r.first.length ? ` +${r.right - r.first.length}` : ''}</small>` : ''}</div>`;
        }
        main = `<div class="tx-seat" id="tts-${c.n}"><div class="tx-hot"><div class="tx-cone"></div><div class="tx-hotl">IN THE HOT SEAT</div>${suspect(c, 0, { cls: 'big lit', num: c.n })}<div class="tx-hotn">Suspect ${c.n} of ${c.total}</div></div>
          <div class="tx-case"><div class="tx-caseh">STATEMENTS OF <b>${esc(c.name)}</b></div>${status}${items(c, s.phase === 'reveal')}</div></div>${polygraph(s.phase === 'vote' || s.phase === 'reveal')}`;
      }
    }
    BOX.morph(el, `<div class="tx tx-tv" data-phase="${esc(s.phase)}"><section class="tx-main">${main}</section>${scoreboard(s.standings)}</div><div class="tx-lamp"></div>`);
  }

  // ---------- phone ----------
  let served = null; // the room's idea-starter pack (server sends it while writing)
  function phone(el, v, ctx, view) {
    const me = view && view.me;
    // JustGold gear: this game's phone theme, a frame and badge over your screen (public/shared/gear.js).
    if (window.MT_GEAR) window.MT_GEAR.phoneTheme(el, arguments[3], 'truths');
    if (v && Array.isArray(v.ideas) && v.ideas.length) served = v.ideas;
    if (!v) return;
    const head = `<div class="tx-me"><span>🏅 <b>${v.points}</b> pt${v.points === 1 ? '' : 's'} · #${v.rank || '-'}</span><span>CASE FILE</span></div>`;
    const wrap = (phase, html) => `<div class="tx tx-ph" data-phase="${phase}">${head}${html}</div>`;
    if (v.phase === 'over') {
      const st = v.stats || {};
      BOX.morph(el, `<div class="tx tx-ph" data-phase="over"><div class="tx-paper tx-center tx-endcard"><div class="tx-closed sm">CASE CLOSED</div><div class="tx-rank">#${v.rank}</div><p class="tx-big">Game over! ${plural(v.points, 'point')}</p>
        ${(v.awards || []).map((a) => `<div class="tx-myaward">${a.icon} <b>${esc(a.title)}</b><small>${esc(a.value)}</small></div>`).join('')}
        <div class="tx-stats"><span>🕵️ ${st.right}/${st.guesses} spotted</span><span>😈 fooled ${st.fooled}</span></div></div>
        <div class="tx-paper">${(v.final || []).map((r, i) => `<div class="tx-row ${i === 0 ? 'lead' : ''}"><span class="tx-rk">${i + 1}</span><span class="tx-av">${face(r, 30)}</span><span class="tx-nm">${esc(r.name)}</span><b>${r.points}</b></div>`).join('')}</div></div>`);
      if (first('over:' + v.rank)) ctx.haptic(v.rank === 1 ? 'win' : 'big');
      return;
    }
    if (v.phase === 'write') {
      if (first('write')) ctx.haptic('turn');
      const prog = `<div class="tx-wbar sm"><span style="width:${v.progress.of ? Math.round((v.progress.done / v.progress.of) * 100) : 0}%"></span></div><p class="tx-muted tx-center">${v.progress.done} / ${v.progress.of} filed ${timer(v.endsIn)}</p>`;
      if (v.written && !editing) {
        BOX.morph(el, wrap('filed', `<div class="tx-paper tx-filed"><div class="tx-fstamp">Ready! FILED</div>${v.mySet.items.map((t, i) => `<p class="${i === v.mySet.lie ? 'is-lie' : ''}"><b>${i + 1}.</b> ${esc(t)}${i === v.mySet.lie ? ' <span class="tx-mini">LIE</span>' : ''}</p>`).join('')}</div>
          ${prog}<p class="tx-muted tx-center">Keep your lie secret… 🤫</p><button class="tx-btn ghost" id="tt-edit">✏️ Change them</button>`));
        el.querySelector('#tt-edit').onclick = () => { editing = true; draft = v.mySet.items.slice(); lie = v.mySet.lie; ctx.redraw(); };
        return;
      }
      const filled = draft.filter((d) => d.trim().length >= 3).length;
      BOX.morph(el, wrap('write', `<div class="tx-paper tx-form"><div class="tx-formh">WITNESS STATEMENT <span>${timer(v.endsIn)}</span></div>
        <div class="tx-hint"><span>${esc(hint())}</span><button class="tx-idea" id="tt-idea">${hintN < 0 ? '💡 Idea?' : 'Another'}</button></div>
        ${[0, 1, 2].map((i) => `<div class="tt-row tx-row3 ${lie === i ? 'is-lie' : ''}"><span class="tx-k">${i + 1}</span><input class="tx-input" data-i="${i}" maxlength="90" placeholder="${['I once…', 'I have never…', 'My weirdest talent is…'][i]}" value="${esc(draft[i])}" autocomplete="off"><button class="tt-liebtn tx-liebtn ${lie === i ? 'on' : ''}" data-lie="${i}" aria-label="Mark as the lie">LIE</button></div>`).join('')}
        <p class="tx-small">${lie == null ? 'Stamp <b>LIE</b> next to the one that’s made up.' : `Statement ${lie + 1} is your lie.`}</p>
        <button class="tx-btn big ${filled === 3 && lie != null ? 'ready' : ''}" id="tt-send" ${filled === 3 && lie != null ? '' : 'data-dim="1"'}>${editing ? 'Save changes' : 'File my statement'}</button>${editing ? '<button class="tx-btn ghost" id="tt-cancel">Cancel</button>' : ''}</div>`));
      for (const inp of el.querySelectorAll('[data-i]')) {
        inp.oninput = () => { draft[Number(inp.dataset.i)] = inp.value; };
        inp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); const nx = el.querySelector(`[data-i="${Number(inp.dataset.i) + 1}"]`); if (nx) nx.focus(); else inp.blur(); } };
      }
      for (const b of el.querySelectorAll('[data-lie]')) b.onclick = () => { lie = Number(b.dataset.lie); ctx.haptic('select'); ctx.redraw(); };
      el.querySelector('#tt-idea').onclick = () => { hintN = hintN < 0 ? Math.floor(Math.random() * (served || HINTS).length) : hintN + 1; ctx.redraw(); };
      const cancel = el.querySelector('#tt-cancel'); if (cancel) cancel.onclick = () => { editing = false; ctx.redraw(); };
      el.querySelector('#tt-send').onclick = async () => {
        for (const inp of el.querySelectorAll('[data-i]')) draft[Number(inp.dataset.i)] = inp.value;
        if (draft.some((d) => d.trim().length < 3)) { ctx.haptic('error'); return ctx.toast('Write all three (a few words each).'); }
        if (lie == null) { ctx.haptic('error'); return ctx.toast('Stamp LIE next to your lie.'); }
        const r = await ctx.act({ op: 'write', items: draft, lie });
        if (r.ok) { ctx.sfx('chime'); ctx.haptic('success'); draft = ['', '', '']; lie = null; editing = false; ctx.redraw(); }
      };
      return;
    }
    editing = false;
    const c = v.seat; if (!c) { BOX.morph(el, wrap('wait', '<div class="tx-paper tx-center"><h3>Bringing in the next suspect…</h3></div>')); return; }
    if (c.mine && v.phase !== 'reveal') {
      if (first('seat:' + c.n)) ctx.haptic('big');
      BOX.morph(el, wrap('hot', `<div class="tx-hotph tx-center"><div class="tx-cone"></div><div class="tx-face">${me && BOX.hasLook && BOX.hasLook(me) ? face(me, 110, { mood: 'serious' }) : '😐'}</div><h3>You’re in the hot seat!</h3><p>${v.phase === 'talk' ? 'They’re grilling you. Defend all three!' : 'Keep a straight face. They’re voting…'}</p><p class="tx-muted">${c.voted} / ${c.of} voted ${timer(v.endsIn)}</p></div>`));
      return;
    }
    if (v.phase === 'talk' || v.phase === 'vote') {
      if (first(v.phase + ':' + c.n)) ctx.haptic(v.phase === 'vote' ? 'turn' : 'tap');
      const q = v.phase === 'talk' ? `🗣️ Grill ${nm(c)}! Lean early (you can change it) ${timer(v.endsIn)}` : `Which one is ${nm(c)}’s lie? ${timer(v.endsIn)}`;
      BOX.morph(el, wrap(v.phase, `<div class="tt-seat small tx-q">${q}</div><div class="tt-votes">${c.items.map((t, i) => `<button class="tt-vote tx-vote ${c.myVote === i ? 'sel' : ''}" data-v="${i}" style="--tl:${tilt(t, 0.8).toFixed(2)}deg"><span class="num">${N[i]}</span><span class="tx-vt">${esc(t)}</span>${c.myVote === i ? '<span class="tx-mark">LIE?</span>' : ''}</button>`).join('')}</div>
        ${c.myVote != null ? `<p class="tx-muted tx-center">${v.phase === 'talk' ? 'Leaning' : 'Vote cast'} ✅ (tap another to change)</p>` : '<p class="tx-muted tx-center">Tap the one you think is the lie.</p>'}`));
      for (const b of el.querySelectorAll('[data-v]')) b.onclick = () => { ctx.act({ op: 'vote', pick: Number(b.dataset.v) }); ctx.sfx('ballot'); ctx.haptic('select'); };
      return;
    }
    if (v.phase === 'reveal' && c.result) {
      const r = c.result, right = c.myVote === c.lie, good = c.mine ? r.fooled > 0 : right;
      const card = c.mine ? (r.fooled ? `<div class="tx-rstamp good">FOOLED ${r.fooled}</div><h3>You fooled ${r.fooled}! +${Math.min(r.fooled, 5)}</h3>` : '<div class="tx-rstamp bad">CAUGHT</div><h3>You fooled nobody!</h3><p>They saw right through you.</p>')
        : c.myVote == null ? '<div class="tx-rstamp">NO VOTE</div><h3>You didn’t vote</h3>' : right ? '<div class="tx-rstamp good">SPOTTED</div><h3>You spotted it! +1</h3>' : '<div class="tx-rstamp bad">FOOLED</div><h3>Fooled!</h3>';
      BOX.morph(el, wrap('reveal', `<div class="tx-paper tx-center tx-result ${good ? 'tx-good' : c.myVote == null && !c.mine ? '' : 'tx-bad'}" id="ttr-${c.n}">${card}<p>The lie was: <b>${esc(c.items[c.lie])}</b></p>${r.twist != null ? `<p class="tx-muted">😱 And “${esc(c.items[r.twist])}” is TRUE!</p>` : ''}</div>`));
      if (first('rv:' + c.n + ':' + c.items.join('|'))) { ctx.sfx(good ? 'chime' : 'shrug'); ctx.haptic(c.mine ? (r.fooled ? 'win' : 'buzz') : c.myVote == null ? 'warn' : right ? 'success' : 'error'); }
      return;
    }
    BOX.morph(el, wrap('watch', '<div class="tx-paper tx-center"><h3>👀 Watch the big screen…</h3></div>'));
  }

  BOX.games.truths = {
    // Soundtrack cue per phase (public/box/scores/<key>.js); the TV turns the last 10 s of 'think' tense.
    music: (s) => ({ write: 'think', talk: 'play', vote: 'tense', reveal: 'reveal', over: 'finale' }[s.phase] || 'play'),
    name: 'Two Truths & a Lie', icon: '🤥',
    about: 'Type two true things and one lie about yourself. Can the room spot your lie?',
    how: [
      'Everyone types three things about themselves on their phone: two true, one lie. Mark the lie.',
      'One by one, a player’s three statements go up on the big screen.',
      'Grill them! Ask questions out loud, then everyone votes on their phone: which one is the lie?',
      'Guess right: +1 point. In the hot seat: +1 for every person you fool (up to 5 points a turn).',
    ],
    // 'clip' = no synth sound: onFx plays a recorded one (and falls back to the old sound).
    fx: { flip: 'clip', talk: 'talk', gavel: 'clip', drum: 'drum', ready: 'clip', win: 'win' },
    onFx(f) {
      const k = f.kind;
      // the next suspect's three statements are typed onto the case file
      if (k === 'flip') clip('typewriter.ogg', { vol: 0.15 }) || (BOX.audio ? BOX.audio.stinger('flip', 'truths') : BOX.sfx('flip'));
      else if (k === 'ready') clip('stamp.ogg', { vol: 0.22, gap: 200 }) || BOX.sfx('pop'); // a suspect's statements are stamped FILED
      else if (k === 'gavel') clip('gavel.ogg', { vol: 0.2 }) || BOX.sfx('gavel'); // voting opens
      else if (k === 'drum') setTimeout(() => BOX.sfx(f.twist ? 'gasp' : f.fooled ? 'laugh' : 'cheer'), 2200);
      else if (k === 'win') clip('flash.ogg', { vol: 0.15, delay: 1.2 }); // case closed: an old press camera's flash powder
    },
    lobbyTv,
    lobby: () => '<div class="tx tx-phlobby"><div class="tx-paper"><div class="tx-formh">WHILE YOU WAIT</div><p>Think of <b>two true things</b> about you and <b>one believable lie</b>. The best lies are boring!</p></div></div>',
    tv,
    phone,
  };
})();
