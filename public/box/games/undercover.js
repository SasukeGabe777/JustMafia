'use strict';
// JustUndercover: TV and phone screens, the designed lobby, haptics. Make it look like its own game:
// see public/box/titles/undercover.js for its style, and the other games for the quality bar.
(function () {
  const { esc, timer } = BOX;
  const av = (r) => esc(r.avatar || '🙂');
  BOX.games["undercover"] = {
    name: "JustUndercover", icon: "🕵️",
    about: 'One line that sells the game.',
    how: ['Step one.', 'Step two.', 'How you win.'],
    fx: { start: 'start', round: 'pop', reveal: 'chime', win: 'win' },
    // The lobby, designed as part of the game. Keep #code, img#qr, #settings selects, #roster .chip, #add-bots, #start.
    lobbyTv(el, L) {
      if (!el.querySelector('.ng-lobby')) {
        el.innerHTML = `<div class="ng-lobby"><h1 class="ng-title">🕵️ ${esc("JustUndercover")}</h1>
          <div class="ng-join"><img id="qr" alt="QR code to join"><div>Room code</div><div class="ng-code" id="code"></div></div>
          <div class="ng-settings" id="settings"></div><div class="ng-roster" id="roster"></div>
          <div class="ng-err" id="lobby-err"></div><button class="btn big" id="start">Start ▶</button>
          <div><button class="link" id="add-bots">+ 5 test bots</button> <button class="link" id="pick">🎮 Another game</button></div></div>`;
        el.querySelector('#start').onclick = async () => { const r = await L.start(); el.querySelector('#lobby-err').textContent = r && r.ok ? '' : (r && r.error) || ''; };
        el.querySelector('#add-bots').onclick = () => L.bots(5);
        el.querySelector('#pick').onclick = () => L.pick();
      }
      el.querySelector('#code').textContent = L.code;
      const q = el.querySelector('#qr'); if (q.dataset.u !== L.qr) { q.src = L.qr; q.dataset.u = L.qr; }
      const set = el.querySelector('#settings'), sig = JSON.stringify(L.settings);
      if (set.dataset.sig !== sig && !set.contains(document.activeElement)) {
        set.dataset.sig = sig;
        set.innerHTML = L.fields.map((f) => `<label>${esc(f.label)}<select data-set="${esc(f.key)}">${f.options.map((o) => `<option value="${esc(String(o.value))}" ${String(L.settings[f.key]) === String(o.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`).join('');
        for (const s of set.querySelectorAll('[data-set]')) s.onchange = () => L.set(s.dataset.set, s.value);
      }
      BOX.morph(el.querySelector('#roster'), L.players.map((p) => `<span class="chip">${av(p)} ${esc(p.name)}</span>`).join('') || '<span class="muted">Scan the code to join!</span>');
    },
    tv(el, s) {
      if (!s) return;
      if (s.phase === 'over') return BOX.morph(el, `<div class="ng-tv"><h2>🏆 ${esc((s.standings[0] || {}).name || '')} wins!</h2>${BOX.board(s.standings, (r) => r.points, ' pts')}</div>`);
      const body = s.phase === 'reveal' && s.last
        ? `<h2>The room picked ${s.last.top}!</h2><div class="ng-bars">${s.last.tally.map((n, i) => `<div><b>${i + 1}</b><i style="height:${n * 20 + 6}px"></i>${n}</div>`).join('')}</div>`
        : `<h2>Pick a number on your phone!</h2><p>${s.picked} of ${s.players} picked · ${timer(s.endsIn)}</p>`;
      BOX.morph(el, `<div class="ng-tv"><div class="ng-round">Round ${s.round} of ${s.of}</div>${body}</div>`);
    },
    phone(el, v, ctx) {
      if (!v) return;
      if (v.phase === 'over') return BOX.morph(el, `<div class="card-box ng-ph"><h3>Game over!</h3><p>You scored ${v.points} points.</p></div>`);
      if (v.phase === 'reveal') return BOX.morph(el, `<div class="card-box ng-ph"><h3>${v.mine === (v.last && v.last.top) ? '🎉 You matched the room!' : 'Not this time!'}</h3></div>`);
      BOX.morph(el, `<div class="card-box ng-ph"><h3>Pick a number</h3><div class="ng-picks">${[1, 2, 3, 4, 5].map((n) => `<button class="btn ${v.mine === n ? 'green' : ''}" data-n="${n}">${n}</button>`).join('')}</div><p class="muted">${timer(v.endsIn)}</p></div>`);
      for (const b of el.querySelectorAll('[data-n]')) b.onclick = async () => { const r = await ctx.act({ op: 'pick', v: Number(b.dataset.n) }); if (r.ok) ctx.haptic('select'); };
    },
  };
})();
