// Role Draft presentation (TV and phones). The server decides everything: which cards,
// the votes, the winners and who gets which role. This file only animates the public
// draft and this phone's own dealt card. Animations start from the server's stage time,
// so every screen is in sync and a reconnecting phone joins mid-animation.
(function () {
  const ROLES = window.MT_ROLES.ROLES;
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const T = () => window.MT_THEMES;
  const roleName = (k, theme) => (T() ? T().roleName(theme, k, ROLES[k].name) : ROLES[k].name);
  const teamLabel = (team, theme) => {
    const base = (window.MT_ROLES.TEAMS[team] || {}).name || team;
    return T() && T().teamName ? T().teamName(theme, team, base) : base;
  };
  const TEAM_EMOJI = { town: '🏡', mafia: '🔪', neutral: '🎭' };
  const sfx = (name) => { try { if (window.SFX) window.SFX.play(name); } catch { /* audio is optional */ } };
  const later = (ms, fn) => setTimeout(fn, Math.max(0, ms));

  // One card face from the real role bank (reference() is generated from roles.js).
  function face(k, theme, opts = {}) {
    const full = opts.full !== false;
    const r = ROLES[k], ref = window.MT_ROLES.reference(k);
    const rules = full ? (ref.restrictions || []).slice(0, 2).map((x) => `<li>${esc(x)}</li>`).join('') : '';
    return `<div class="dc-face team-${r.team}" style="--rc:${r.color}">
      <div class="dc-team">${TEAM_EMOJI[r.team] || ''} ${esc(teamLabel(r.team, theme))}</div>
      <div class="dc-art"><span>${r.emoji}</span></div>
      <div class="dc-name">${esc(roleName(k, theme))}</div>
      <div class="dc-when">⏱ ${esc(ref.when)}</div>
      <div class="dc-text">${esc(opts.blurb || r.blurb)}</div>
      ${rules ? `<ul class="dc-rules">${rules}</ul>` : ''}
    </div>`;
  }
  const BACK = '<div class="dc-back"><div class="dc-sigil">?</div></div>';
  function cardEl(k, theme, opts = {}) {
    const el = document.createElement('div');
    el.className = 'dcard' + (opts.up ? ' up' : '');
    if (k) el.dataset.card = k;
    el.innerHTML = `<div class="dc-inner"><div class="dc-front">${k ? face(k, theme, opts) : ''}</div><div class="dc-backside">${BACK}</div></div>`;
    return el;
  }

  // Ranking by current votes: the top `picks` cards are "leading".
  function leaders(d) {
    const sorted = d.cards.slice().sort((a, b) => d.tally[b] - d.tally[a]);
    const cut = d.tally[sorted[d.picks - 1]] || 0;
    return new Set(sorted.filter((k, i) => d.tally[k] > 0 && (i < d.picks || d.tally[k] === cut)));
  }

  // ---- deck choreography (Web Animations), shared by both screens ----
  // Riffle: split into two halves, then cascade back into one stack.
  function riffleFrames(i, n, spread, from, to) {
    const side = i % 2 ? 1 : -1, step = (to - from);
    return [
      { offset: from, transform: `translate(0px, ${-i * 0.6}px) rotate(0deg)` },
      { offset: from + step * 0.35, transform: `translate(${side * spread}px, ${-i * 0.4}px) rotate(${side * 7}deg)` },
      { offset: from + step * (0.55 + 0.4 * (i / n)), transform: `translate(0px, ${-i * 0.6}px) rotate(0deg)` },
    ];
  }
  function play(el, frames, duration, elapsed, delay = 0) {
    const a = el.animate(frames, { duration, delay, fill: 'both', easing: 'ease-in-out' });
    a.currentTime = Math.min(duration + delay, Math.max(0, elapsed));
    return a;
  }

  function layoutSlots(k, W, H, maxW) {
    const perRow = k <= 5 ? k : Math.ceil(k / 2), rows = Math.ceil(k / perRow);
    const cw = Math.max(90, Math.min(maxW, (W * 0.94) / perRow - 18, ((H * 0.66) / rows - 18) / 1.45));
    const ch = cw * 1.45, gap = Math.max(10, cw * 0.09), slots = [];
    for (let i = 0; i < k; i++) {
      const row = Math.floor(i / perRow), inRow = Math.min(perRow, k - row * perRow), col = i - row * perRow;
      slots.push({ x: (col - (inRow - 1) / 2) * (cw + gap), y: (row - (rows - 1) / 2) * (ch + gap) });
    }
    return { cw, ch, slots };
  }

  // ======================= TV =======================
  function TV(root) {
    let key = '', cards = [], layout = null, clockOffset = 0, deadline = null;
    const table = () => root.querySelector('.draft-table');
    const now = () => Date.now() + clockOffset;
    function chrome(title, sub) {
      root.innerHTML = `<div class="draft-head"><h1>${title}</h1><p class="draft-sub">${sub}</p></div><div class="draft-table"></div><div class="draft-foot"></div><div class="draft-timer" hidden></div>`;
    }
    function measure(k) {
      const t = table(), r = t.getBoundingClientRect();
      layout = layoutSlots(k, r.width, r.height, 230);
      t.style.setProperty('--cw', layout.cw + 'px'); t.style.setProperty('--ch', layout.ch + 'px');
    }
    function deck(n, extraClass = '') {
      const els = [];
      for (let i = 0; i < n; i++) { const c = cardEl(null); c.classList.add('deck-card'); if (extraClass) c.classList.add(extraClass); table().appendChild(c); els.push(c); }
      return els;
    }
    const at = (s) => `translate(${s.x}px, ${s.y}px) rotate(0deg)`;

    function build(st, d, elapsed) {
      const theme = st.theme, k = d.cards.length;
      cards = [];
      if (d.stage === 'deck') {
        chrome('🂠 The Deck of Roles', 'Every game is different. Watch the deck…');
        measure(k);
        const N = 22, dur = 7000, els = deck(N);
        els.forEach((c, i) => {
          const a = -55 + (110 * i) / (N - 1);
          const frames = [
            { offset: 0, transform: 'translate(0px, -110vh) rotate(-25deg)' },
            { offset: 0.1, transform: `translate(0px, ${-i * 0.6}px) rotate(0deg)` },
            { offset: 0.18, transform: `translate(0px, ${-i * 0.6}px) rotate(0deg)` },
            { offset: 0.36, transform: `translate(${Math.sin(a * Math.PI / 180) * layout.cw * 2.4}px, ${(1 - Math.cos(a * Math.PI / 180)) * layout.cw * 1.4 - layout.cw * 0.3}px) rotate(${a}deg)` },
            { offset: 0.46, transform: `translate(0px, ${-i * 0.6}px) rotate(0deg)` },
            ...riffleFrames(i, N, layout.cw * 0.9, 0.5, 0.76).slice(1),
            { offset: 0.84, transform: `translate(0px, ${-i * 0.6}px) rotate(0deg)` },
            { offset: 1, transform: i < k ? at(layout.slots[i]) : 'translate(0px, 70vh) rotate(10deg)', opacity: i < k ? 1 : 0 },
          ];
          play(c, frames, dur, elapsed);
        });
        [[1300, 'shuffle'], [3500, 'shuffle'], [5900, 'deal']].forEach(([t, s]) => { if (elapsed < t) later(t - elapsed, () => sfx(s)); });
        return;
      }
      if (d.stage === 'vote' || d.stage === 'result') {
        const voting = d.stage === 'vote';
        chrome(voting ? '🗳 Choose the roles' : '✨ The town has chosen',
          voting ? `Vote on your phone for up to <b>${d.picks}</b> roles you want in this game.` : `${d.result && d.result.roles.length ? 'These roles join the game. Mafia and Villagers fill the other seats.' : 'No valid mix was voted in, so this game uses the classic setup.'}${d.result && d.result.tie ? ' A tie was settled by a random draw.' : ''}`);
        measure(k);
        d.cards.forEach((role, i) => {
          const c = cardEl(role, theme, { up: !voting || elapsed > 1600 + i * 160, full: false }); // TV: name, art, team, timing and description (rules list is on phones)
          c.style.transform = at(layout.slots[i]);
          c.insertAdjacentHTML('beforeend', '<div class="dc-votes"><b>0</b> votes<div class="dc-bar"><i></i></div></div><div class="dc-ribbon">IN THE GAME</div>');
          table().appendChild(c); cards.push(c);
          if (!c.classList.contains('up')) later(300 + i * 160 - elapsed, () => { c.classList.add('up'); sfx('flip'); });
        });
        if (!voting) {
          const won = new Set((d.result && d.result.roles) || []);
          cards.forEach((c) => c.classList.add(won.has(c.dataset.card) ? 'win' : 'out'));
          later(1400 - elapsed, () => cards.forEach((c) => { if (c.classList.contains('out')) c.classList.remove('up'); }));
          if (elapsed < 300) sfx('saved');
        }
        return;
      }
      if (d.stage === 'collect') {
        chrome('🂠 Back into the deck', 'The cards are shuffled… secret roles are about to be dealt.');
        measure(k);
        const dur = 5000, N = 22, won = new Set((d.result && d.result.roles) || []);
        d.cards.forEach((role, i) => {
          const c = cardEl(role, theme, { up: won.has(role) && elapsed < 700, full: false });
          table().appendChild(c); cards.push(c);
          play(c, [{ offset: 0, transform: at(layout.slots[i]) }, { offset: 0.2, transform: at(layout.slots[i]) }, { offset: 0.38, transform: `translate(0px, ${-i * 0.6}px) rotate(0deg)` }, ...riffleFrames(i, N, layout.cw * 0.9, 0.45, 0.85).slice(1), { offset: 1, transform: `translate(0px, ${-i * 0.6}px) rotate(0deg)` }], dur, elapsed);
          if (c.classList.contains('up')) later(700 - elapsed, () => c.classList.remove('up'));
        });
        deck(N - k).forEach((c, j) => {
          const i = j + k;
          play(c, [{ offset: 0, opacity: 0, transform: `translate(0px, ${-i * 0.6}px)` }, { offset: 0.36, opacity: 0, transform: `translate(0px, ${-i * 0.6}px)` }, { offset: 0.4, opacity: 1, transform: `translate(0px, ${-i * 0.6}px) rotate(0deg)` }, ...riffleFrames(i, N, layout.cw * 0.9, 0.45, 0.85).slice(1), { offset: 1, opacity: 1, transform: `translate(0px, ${-i * 0.6}px) rotate(0deg)` }], dur, elapsed);
        });
        [[1900, 'shuffle'], [3200, 'shuffle']].forEach(([t, s]) => { if (elapsed < t) later(t - elapsed, () => sfx(s)); });
        return;
      }
      if (d.stage === 'deal') {
        chrome('🤫 Your secret role', 'Flip your card on your phone. Keep it hidden!');
        const people = st.players.filter((p) => !p.spectator && !p.left);
        measure(1);
        const r = table().getBoundingClientRect();
        const small = Math.max(42, Math.min(84, (2 * Math.PI * r.width * 0.4) / Math.max(people.length, 1) * 0.5, r.height * 0.16));
        // Keep the whole ring (card + name plate) inside the table, clear of the title and footer.
        const rx = Math.min(r.width * 0.42, r.width / 2 - small / 2 - 30), ry = Math.max(50, r.height / 2 - small * 0.725 - small * 0.45 - 8);
        table().style.setProperty('--cw', small + 'px'); table().style.setProperty('--ch', small * 1.45 + 'px');
        deck(6).forEach((c, i) => { c.style.transform = `translate(0px, ${-i * 0.8}px)`; });
        people.forEach((p, i) => {
          const a = (i / people.length) * Math.PI * 2 - Math.PI / 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
          const c = cardEl(null); c.classList.add('dealt'); c.dataset.pid = p.id;
          c.insertAdjacentHTML('beforeend', `<div class="dc-plate">${esc(p.name)}<span class="dc-seen">✓</span></div>`);
          table().appendChild(c); cards.push(c);
          const t0 = 500 + i * Math.min(180, 3600 / people.length);
          play(c, [{ offset: 0, transform: 'translate(0px, 0px) rotate(0deg)', opacity: 0 }, { offset: 0.01, opacity: 1, transform: 'translate(0px, 0px) rotate(0deg)' }, { offset: 1, opacity: 1, transform: `translate(${x}px, ${y}px) rotate(${(i % 2 ? 1 : -1) * 6}deg)` }], 520, elapsed, t0);
          if (elapsed < t0 && i % 3 === 0) later(t0 - elapsed, () => sfx('deal'));
        });
      }
    }

    function update(st, d) {
      const foot = root.querySelector('.draft-foot');
      if (d.stage === 'vote' || d.stage === 'result') {
        const lead = leaders(d), max = Math.max(1, ...Object.values(d.tally));
        for (const c of cards) {
          const n = d.tally[c.dataset.card] || 0;
          c.querySelector('.dc-votes b').textContent = n;
          c.querySelector('.dc-bar i').style.width = `${(100 * n) / max}%`;
          c.classList.toggle('lead', d.stage === 'vote' && lead.has(c.dataset.card));
        }
        if (foot) foot.textContent = d.stage === 'vote' ? `${d.ready}/${d.total} locked in · ${d.voted}/${d.total} have voted · ⭐ = leading` : '';
      } else if (d.stage === 'deal') {
        const seen = new Set(d.flippedIds || []);
        for (const c of cards) c.classList.toggle('seen', seen.has(c.dataset.pid));
        if (foot) foot.textContent = `${seen.size}/${cards.length} have looked at their card`;
      } else if (foot) foot.textContent = '';
      deadline = st.endsAt;
    }

    setInterval(() => {
      const el = root.querySelector('.draft-timer');
      if (!el) return;
      const s = deadline ? Math.max(0, Math.ceil((deadline - now()) / 1000)) : null;
      el.hidden = s == null || root.hidden || !root.querySelector('.dc-votes') || !root.querySelector('.draft-head h1').textContent.includes('Choose');
      el.textContent = s == null ? '' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      el.classList.toggle('urgent', s != null && s <= 10);
    }, 250);

    return {
      render(st) {
        clockOffset = st.serverNow - Date.now();
        const d = st.draft;
        const show = !!d && (st.phase === 'draft' || st.phase === 'roleReveal');
        root.hidden = !show;
        if (!show) { key = ''; return; }
        const k = `${d.id}:${d.stage}`;
        if (k !== key) { key = k; build(st, d, Math.max(0, now() - d.stageAt)); }
        update(st, d);
      },
    };
  }

  // ======================= Phone =======================
  // ctx: { socket, theme, extrasHtml(), roleLabel(k) }
  function Phone() {
    let key = '', root = null, flipped = false;
    function build(view, d, elapsed, ctx) {
      const theme = view.theme;
      if (d.stage === 'deck' || d.stage === 'collect') {
        root.innerHTML = `<div class="card center draft-wait"><div class="mini-deck"></div><h2>${d.stage === 'deck' ? 'Shuffling the deck of roles…' : 'Back into the deck…'}</h2><p class="muted">${d.stage === 'deck' ? 'Get ready to vote on which roles are in this game.' : 'Your secret card is about to be dealt.'}</p></div>`;
        const md = root.querySelector('.mini-deck');
        for (let i = 0; i < 10; i++) {
          const c = cardEl(null); md.appendChild(c);
          play(c, [{ offset: 0, transform: `translate(0px, ${-i}px)` }, ...riffleFrames(i, 10, 46, 0.15, 0.55).slice(1), ...riffleFrames(i, 10, 46, 0.6, 0.95).slice(1), { offset: 1, transform: `translate(0px, ${-i}px)` }], 4200, elapsed % 4200);
        }
        return;
      }
      if (d.stage === 'vote' || d.stage === 'result') {
        const voting = d.stage === 'vote', won = new Set((d.result && d.result.roles) || []);
        root.innerHTML = `<div class="card draft-intro">${voting
          ? `<h2>🗳 Choose the roles</h2><p>Vote for up to <b>${d.picks}</b> roles you want in this game. The most-voted roles go in; Mafia and Villagers fill the other seats. <span class="muted">(There is always at least one Mafia.)</span></p><p class="draft-left" data-left></p>`
          : `<h2>✨ The town has chosen</h2><p>${won.size ? 'These roles are in the game:' : 'No valid mix was voted in, so this game uses the classic setup.'}${d.result && d.result.tie ? ' A tie was settled by a random draw.' : ''}</p>`}</div>
          <div class="draft-list">${(voting ? d.cards : d.cards.slice().sort((a, b) => won.has(b) - won.has(a))).map((k, i) => `<div class="draft-item${voting ? '' : won.has(k) ? ' win' : ' out'}" data-item="${k}" style="animation-delay:${Math.max(0, i * 0.12 - elapsed / 1000)}s">
            ${face(k, theme)}
            ${voting ? `<div class="draft-vote-row"><span class="dv-count"><b data-count>0</b> votes <span data-lead></span></span><button class="btn" data-dv="${k}">Vote</button></div>` : `<div class="draft-vote-row"><span class="dv-count"><b>${d.tally[k] || 0}</b> votes</span><span class="dv-tag">${won.has(k) ? '✅ In the game' : 'Out'}</span></div>`}
          </div>`).join('')}</div>
          ${voting ? '<div class="draft-lock"><button class="btn btn-big" data-lock>🔒 Lock in my votes</button><p class="muted small center" data-progress></p></div>' : ''}`;
        root.querySelectorAll('[data-dv]').forEach((b) => b.addEventListener('click', () => {
          const role = b.dataset.dv, on = !(ctx.mine() || []).includes(role);
          ctx.socket.emit('player:draftVote', { role, on }, (r) => { if (r && !r.ok && r.error) ctx.toast(r.error); });
          if (navigator.vibrate) navigator.vibrate(15);
        }));
        const lock = root.querySelector('[data-lock]');
        if (lock) lock.addEventListener('click', () => ctx.socket.emit('player:draftVote', { ready: true }, (r) => { if (r && !r.ok && r.error) ctx.toast(r.error); }));
        return;
      }
      if (d.stage === 'deal') {
        flipped = false;
        root.innerHTML = `<p class="center muted deal-hint">Your card has been dealt. <b>Tap it to flip.</b> Don't let anyone see!</p>
          <div class="deal-zone"></div><div class="deal-extras" hidden></div>`;
        const c = cardEl(view.role, theme, { full: true, blurb: view.roleBlurb });
        c.classList.add('my-card');
        root.querySelector('.deal-zone').appendChild(c);
        play(c, [{ transform: 'translate(0px, -70vh) rotate(-30deg) scale(.6)' }, { transform: 'translate(0px, 0px) rotate(0deg) scale(1)' }], 900, elapsed);
        c.addEventListener('click', () => {
          flipped = !flipped;
          c.classList.toggle('up', flipped);
          root.querySelector('.deal-hint').innerHTML = flipped ? 'This is your secret role. <b>Tap to hide it.</b>' : 'Tap your card to see your role again.';
          root.querySelector('.deal-extras').hidden = !flipped;
          if (flipped) { if (navigator.vibrate) navigator.vibrate([30, 40, 30]); ctx.socket.emit('player:flip', {}); }
        });
        const ex = ctx.extrasHtml(); root.querySelector('.deal-extras').innerHTML = ex ? `<div class="card">${ex}</div>` : '';
      }
    }
    function update(view, d) {
      if (d.stage !== 'vote') return;
      const mine = new Set(d.mine || []), lead = leaders(d);
      root.querySelectorAll('[data-item]').forEach((el) => {
        const k = el.dataset.item, sel = mine.has(k);
        el.querySelector('[data-count]').textContent = d.tally[k] || 0;
        el.querySelector('[data-lead]').textContent = lead.has(k) ? '⭐ leading' : '';
        el.classList.toggle('picked', sel);
        const b = el.querySelector('[data-dv]');
        b.textContent = sel ? '✓ Voted' : 'Vote';
        b.classList.toggle('ghost', !sel);
        b.disabled = d.locked || (!sel && mine.size >= d.picks);
      });
      const left = root.querySelector('[data-left]');
      if (left) left.textContent = d.locked ? '🔒 Your votes are locked in.' : `You have ${d.picks - mine.size} vote${d.picks - mine.size === 1 ? '' : 's'} left.`;
      const lock = root.querySelector('[data-lock]');
      if (lock) { lock.disabled = d.locked; lock.textContent = d.locked ? '✓ Locked in' : '🔒 Lock in my votes'; }
      const pr = root.querySelector('[data-progress]');
      if (pr) pr.textContent = `${d.ready}/${d.total} locked in`;
    }
    return {
      // Returns true when the draft owns the screen (play.js then skips its normal body).
      render(mount, view, ctx) {
        const d = view.draft;
        if (!d || !['draft', 'roleReveal'].includes(view.phase) || view.you.spectator || view.isJudge || (view.phase === 'roleReveal' && !view.role)) { key = ''; return false; }
        if (!root || !mount.contains(root)) { root = document.createElement('div'); root.className = 'draft-phone'; mount.innerHTML = ''; mount.appendChild(root); key = ''; }
        const k = `${d.id}:${d.stage}`;
        if (k !== key) { key = k; build(view, d, Math.max(0, Date.now() + ctx.clockOffset() - d.stageAt), ctx); }
        update(view, d);
        return true;
      },
    };
  }

  window.MT_DRAFT = { TV, Phone, face, cardEl };
})();
