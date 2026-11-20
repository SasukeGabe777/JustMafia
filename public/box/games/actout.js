'use strict';
// Act It Out screens. A plum-velvet theatre: the TV is the stage (curtains, footlights, a
// spotlight on whoever is acting), a clock ring, and the guess feed (blurred until right).
// Phones: the actor gets the secret prompt big with Skip (once) and ✅ They got it!; guessers
// type guesses (fuzzy matched on the server); after each scene everyone applauds 👏.
// The lobby is the theatre's playbill + box office; the end is an awards night.
(function () {
  const { esc } = BOX;
  // Players as their JustGameBox character (public/box/portrait.js), or their emoji without one.
  const has = (x) => !!(x && BOX.hasLook && BOX.hasLook(x));
  const av = (x, n = 30, o) => (BOX.face ? BOX.face(x, n, { cls: 'ao-af', ...(o || {}) }) : esc((x && x.avatar) || '🙂'));
  const plural = (n, w, ws) => `${n} ${n === 1 ? w : ws || w + 's'}`;
  const secs = (ms) => (ms / 1000).toFixed(1) + 's';
  const TW = {
    classic: { icon: '🎭', name: 'Act it out', rule: 'Gestures, faces and noises: just don’t say the words!' },
    silent: { icon: '🎞️', name: 'Silent movie', rule: 'No sounds at all. Not even a hum!' },
    sound: { icon: '🔊', name: 'Sound effects only', rule: 'Hands behind your back! Noises only, no words.' },
    style: { icon: '🎨', name: 'Act it as…', rule: 'Stay in character the whole time!' },
    freeze: { icon: '🧊', name: 'Freeze frame', rule: 'Strike ONE pose and hold it. Change pose only when your phone buzzes!' },
    relay: { icon: '🏃', name: 'Charades relay', rule: 'The spotlight passes between actors: take over when your phone buzzes!' },
    scene: { icon: '👯', name: 'Two-person scene', rule: 'Two actors, two secret prompts, one scene. Guess both!' },
  };
  const castNames = (cast) => cast.map((c) => esc(c.name)).join(cast.length > 2 ? ', ' : ' & ');
  const wordTiles = (n) => `<span class="ao-tiles">${Array.from({ length: Math.min(n, 8) }, () => '<i></i>').join('')}</span><span class="ao-wc">${plural(n, 'word')}</span>`;
  const clueChip = (pr) => `<span class="ao-clue ${pr.solved ? 'solved' : ''}"><span class="ic">${esc(pr.icon)}</span><b>${esc(pr.catLabel)}</b>${wordTiles(pr.words)}</span>`;
  const twistLine = (s) => s.kind === 'style' && s.style ? `Act it <b>${esc(s.style.icon)} ${esc(s.style.label)}</b>` : esc(s.twist ? s.twist.rule : '');

  // ---------------- TV: a clock ring that ticks on its own ----------------
  const TV = { key: '', ends: 0, total: 1, legEnds: 0, raf: 0 };
  const RING = 2 * Math.PI * 52;
  function tick() {
    TV.raf = requestAnimationFrame(tick);
    const c = document.getElementById('ao-clock'); if (!c) return;
    if (!c.firstChild) c.innerHTML = `<svg viewBox="0 0 120 120"><circle class="bg" cx="60" cy="60" r="52"/><circle class="fg" cx="60" cy="60" r="52" stroke-dasharray="${RING.toFixed(1)}"/></svg><b></b><small>sec</small>`;
    const left = Math.max(0, TV.ends - Date.now()), k = Math.max(0, Math.min(1, left / TV.total));
    const fg = c.querySelector('.fg'); fg.style.strokeDashoffset = String(RING * (1 - k));
    const s = Math.ceil(left / 1000), b = c.querySelector('b'); if (b.textContent !== String(s)) b.textContent = String(s);
    c.classList.toggle('hot', left < 10000 && left > 0);
    const leg = document.getElementById('ao-leg'); if (leg) leg.textContent = Math.ceil(Math.max(0, TV.legEnds - Date.now()) / 1000) + 's';
  }

  // ---------------- TV screens ----------------
  function stage(inner, cls = '') {
    return `<div class="ao-stage ${cls}"><div class="ao-valance"></div><div class="ao-cur l"></div><div class="ao-cur r"></div><div class="ao-masks"><span>🎭</span></div><div class="ao-floor"></div><div class="ao-foot">${'<i></i>'.repeat(14)}</div><div class="ao-in">${inner}</div></div>`;
  }
  function star(c, o = {}) {
    return `<div class="ao-star ${o.on === false ? 'off' : ''} ${o.cls || ''}" style="--c:${esc(c.color || '#ffc93c')}"><div class="ao-beam"></div>${has(c) ? `<div class="ao-fig">${BOX.body(c, 230, { cls: 'ao-figimg', mood: /done/.test(o.cls || '') ? 'grin' : undefined })}</div>` : `<div class="ao-av">${esc(c.avatar || '🙂')}</div>`}<div class="ao-nm">${esc(c.name)}</div>${o.sub ? `<div class="ao-sub">${o.sub}</div>` : ''}</div>`;
  }
  function topBar(s) {
    return `<div class="ao-top"><span class="ao-turn">Turn <b>${s.n}</b> of ${s.of}</span><span class="ao-tw ${esc(s.kind || '')}">${esc(s.twist ? s.twist.icon : '🎭')} ${esc(s.twist ? s.twist.name : '')}</span>${s.last ? `<span class="ao-final">🏁 FINAL SCENE · POINTS ×${s.mult}</span>` : ''}<span class="ao-sp"></span><div class="ao-clock" id="ao-clock" data-keep></div></div>`;
  }
  function boardStrip(s) {
    return `<div class="ao-strip">${(s.standings || []).map((r, i) => `<span class="ao-sr ${i === 0 && r.points ? 'lead' : ''}" style="--c:${esc(r.color)}"><i>${i + 1}</i>${av(r)} ${esc(r.name)} <b>${r.points}</b>${r.gain ? `<em>+${r.gain}</em>` : ''}</span>`).join('')}${s.count > (s.standings || []).length ? `<span class="ao-sr more">+${s.count - s.standings.length}</span>` : ''}</div>`;
  }
  function feedHtml(s) {
    const f = (s.feed || []).slice().reverse();
    return `<aside class="ao-feed"><h3>💬 Guesses <small>${s.guessCount || 0}</small></h3><div class="ao-bubbles">${f.length ? f.map((g) => `<div class="ao-bub ${g.res}" id="ao-g${g.seq}" style="--c:${esc(g.color)}"><span class="who">${av(g)} ${esc(g.name)}</span><span class="txt">${esc(g.text)}</span>${g.res === 'close' ? '<em>🔥 close!</em>' : g.res === 'right' ? '<em>✅ GOT IT</em>' : ''}</div>`).join('') : '<div class="ao-empty">Type your guesses on your phone…<br>or shout them out!</div>'}</div></aside>`;
  }
  function tvCast(s) {
    const tw = s.twist || TW.classic;
    const sub = (c) => (s.kind === 'relay' ? `Runner ${c.leg + 1}` : s.kind === 'scene' ? `Prompt ${'AB'[c.k] || ''}` : '');
    return stage(`<div class="ao-marquee"><small>${s.last ? '🏁 THE FINAL SCENE' : `SCENE ${s.n}`}</small>NOW STARRING</div>
      <div class="ao-stars n${Math.min(4, s.cast.length)}">${s.cast.map((c) => star(c, { sub: sub(c) })).join('')}</div>
      <div class="ao-twcard ${esc(s.kind)}"><div class="ic">${esc(tw.icon)}</div><div><b>${esc(tw.name)}</b><span>${twistLine(s)}</span></div></div>
      <div class="ao-hint">📱 ${castNames(s.cast)}: check your phone${s.cast.length > 1 ? 's' : ''} for the secret prompt${s.kind === 'scene' ? 's' : ''}!</div>`, 'cast');
  }
  function tvCue(s) {
    return stage(`<div class="ao-cue"><span class="w1">LIGHTS…</span><span class="w2">CAMERA…</span><span class="w3">ACTION!</span></div><div class="ao-clap">🎬</div>`, 'cue');
  }
  function tvAct(s) {
    const relay = s.relay, scene = s.kind === 'scene';
    let stars;
    if (scene) stars = s.cast.map((c) => { const pr = s.prompts[c.k] || {}; return star(c, { sub: pr.solved ? `✅ ${esc(pr.text)}` : clueChip(pr), cls: pr.solved ? 'done' : '' }); }).join('');
    else if (relay) stars = s.cast.map((c, i) => star(c, { on: i === relay.leg, sub: i === relay.leg ? `🔦 ON STAGE · <span id="ao-leg" data-keep></span>` : i < relay.leg ? 'done ✓' : 'up next', cls: i < relay.leg ? 'past' : '' })).join('');
    else stars = s.cast.map((c) => star(c)).join('');
    const pr0 = s.prompts[0] || {};
    const solved = !scene && pr0.solved;
    return `<div class="ao-act">${stage(`
      ${s.kind !== 'classic' ? `<div class="ao-twbar ${esc(s.kind)}">${esc(s.twist.icon)} <b>${esc(s.twist.name)}</b> · ${twistLine(s)}</div>` : ''}
      <div class="ao-stars n${Math.min(4, s.cast.length)} ${scene ? 'scene' : ''}">${stars}</div>
      ${scene ? '' : `<div class="ao-clues">${clueChip(pr0)}</div>`}
      ${s.pose ? `<div class="ao-pose" id="ao-pose-${s.pose.n}"><small>FREEZE FRAME</small>POSE <b>${s.pose.n}</b> / ${s.pose.of}</div>` : ''}
      ${solved ? `<div class="ao-gotit"><small>GOT IT!</small>${esc(pr0.text)}<span>${av(pr0.solved)} ${esc(pr0.solved.name)} · ${secs(pr0.solved.ms)}</span></div>` : ''}`, 'act')}${feedHtml(s)}</div>`;
  }
  function tvBravo(s) {
    const cards = s.prompts.map((pr) => `<div class="ao-reveal ${pr.solved ? 'yes' : 'no'}"><small>${esc(pr.icon)} ${esc(pr.catLabel)}${s.prompts.length > 1 ? ` · prompt ${'AB'[pr.k]}` : ''}</small><div class="t">${esc(pr.text || '')}</div>
      <div class="by">${pr.solved ? `✅ ${av(pr.solved)} <b>${esc(pr.solved.name)}</b> got it in ${secs(pr.solved.ms)}${pr.solved.said ? ` <span class="said">“${esc(pr.solved.said)}”</span>` : ' <span class="said">(called by the actor)</span>'}` : pr.gone ? '🚪 The actor left the stage' : '⏰ Nobody got it!'}</div>
      ${pr.skipped && pr.skipped.length ? `<div class="sk">⏭ skipped: ${pr.skipped.map(esc).join(', ')}</div>` : ''}</div>`).join('');
    const max = Math.max(1, ...(s.claps || []).map((c) => c.n));
    const meters = s.cast.map((c) => { const n = ((s.claps || []).find((x) => x.id === c.id) || {}).n || 0; return `<div class="ao-meter" style="--c:${esc(c.color)}"><span class="nm">${av(c)} ${esc(c.name)}</span><div class="bar"><i style="width:${Math.round((n / max) * 100)}%"></i></div><b>${n} 👏</b></div>`; }).join('');
    const gains = (s.gains || []).map((g) => `<div class="ao-gain" style="--c:${esc(g.color)}"><span>${av(g)} ${esc(g.name)}</span><small>${[...new Set(g.why)].map((w) => ({ guess: '🔮', act: '🎭', clap: '👏' }[w] || '')).join('')}</small><b>+${g.pts}</b></div>`).join('');
    return stage(`<div class="ao-reveals n${s.prompts.length}">${cards}</div>
      <div class="ao-bravo"><div class="ao-bh">👏 <b>Best performance?</b> Applaud on your phone! <span class="muted">${s.clapped || 0}/${s.voters || 0}</span></div>${meters}</div>
      ${gains ? `<div class="ao-gains">${gains}</div>` : ''}`, 'bravo');
  }
  function tvOver(el, s) {
    const f = s.final || { standings: [], awards: [] }, st = f.standings;
    const pod = [st[1], st[0], st[2]].map((r, i) => r ? `<div class="ao-pod p${[2, 1, 3][i]}" style="--c:${esc(r.color)}"><div class="statue">${i === 1 ? '🏆' : '🎭'}</div>${has(r) ? `<div class="fig">${BOX.body(r, i === 1 ? 170 : 140, { mood: i === 1 ? 'grin' : 'smile' })}</div>` : `<div class="av">${esc(r.avatar || '🙂')}</div>`}<div class="nm">${esc(r.name)}</div><div class="pts">${r.points}</div><div class="blk">${[2, 1, 3][i]}</div></div>` : '<div class="ao-pod empty"></div>').join('');
    BOX.morph(el, `<div class="ao-tv ao-over">${stage(`<div class="ao-marquee big"><small>TONIGHT’S</small>ACT IT OUT AWARDS</div>
      <div class="ao-endgrid"><div class="ao-podium">${pod}</div>
        <div class="ao-awards">${f.awards.map((a, i) => `<div class="ao-award" style="--c:${esc(a.color)};animation-delay:${0.5 + i * 0.3}s"><div class="ic">${esc(a.icon)}</div><div><small>${esc(a.title)}</small><b>${esc(a.name)}</b><span>${esc(a.why)}</span></div></div>`).join('')}</div></div>
      <div class="ao-rest">${st.slice(3).map((r, i) => `<span>${i + 4}. ${av(r)} ${esc(r.name)} <b>${r.points}</b></span>`).join('')}</div>`, 'over')}</div>`);
  }
  // Recorded sound effects (public/audio/sfx/actout/, CC0, see credits.json there): a quiet theatre
  // audience and a clapperboard on the TV. warm() decodes them once (silently) as soon as audio is
  // unlocked so the first one is on time.
  const REC = ['clapper', 'cheer', 'applause'];
  let recWarm = false;
  const rec = (f, o) => !!(BOX.audio && BOX.audio.clip && BOX.audio.clip('actout/' + f + '.ogg', o));
  const warm = () => { if (!recWarm && rec(REC[0], { vol: 0, gap: 0 })) { recWarm = true; for (const f of REC.slice(1)) rec(f, { vol: 0, gap: 0 }); } };
  function tv(el, s) {
    if (!s) return;
    warm();
    if (!TV.raf) TV.raf = requestAnimationFrame(tick);
    const key = s.phase + ':' + s.n;
    if (TV.key !== key) { TV.key = key; TV.total = Math.max(1, s.phaseMs || s.endsIn || 1); }
    TV.ends = Date.now() + (s.endsIn || 0);
    if (s.phase === 'act' && s.prompts.every((p) => p.solved || p.gone)) TV.total = Math.max(TV.total, 1);
    TV.legEnds = s.relay ? Date.now() + s.relay.legEndsIn : 0;
    if (s.phase === 'over') return tvOver(el, s);
    let body = '';
    if (s.phase === 'cast') body = tvCast(s);
    else if (s.phase === 'cue') body = tvCue(s);
    else if (s.phase === 'act') body = tvAct(s);
    else if (s.phase === 'bravo') body = tvBravo(s);
    BOX.morph(el, `<div class="ao-tv ph-${esc(s.phase)}" id="ao-${esc(s.phase)}-${s.n}">${topBar(s)}<div class="ao-main">${body}</div>${boardStrip(s)}</div>`);
  }

  // ---------------- TV lobby: the playbill and the box office ----------------
  const BILL = {
    turns: { lab: 'Scenes tonight', opts: { 6: '6', 8: '8', 10: '10', 12: '12' } },
    seconds: { lab: 'Time on stage', opts: { 45: '45s', 60: '60s', 90: '90s' } },
    twists: { lab: 'Plot twists', opts: { some: '🎨 Every other', lots: '🌀 Every scene', off: '🎭 Classic only' } },
    pack: { lab: 'The script', opts: { mix: '🎟️ Everything', family: '🧸 Family', party: '🥂 Party' } },
    showIntro: { lab: 'Opening number', opts: { true: '🎺 On', false: '⏩ Skip' } },
  };
  let LOBBY = null;
  function lobbyTv(el, L) {
    LOBBY = L;
    if (!el.querySelector('.aol')) {
      el.innerHTML = `<div class="aol">${stage('', 'lobby')}
        <div class="aol-wrap">
          <div class="aol-marquee"><div class="aol-bulbs">${'<i></i>'.repeat(26)}</div><small>★ NOW CASTING ★</small><h1>Act It <b>Out!</b></h1><p>Act it · Guess it · Steal the show</p></div>
          <div class="aol-cols">
            <section class="aol-bill"><div class="aol-bh">🎭 THE PLAYBILL <span>tap to change</span></div><div id="settings" class="aol-set"></div>
              <div class="aol-twists"><span>🎞️ Silent movie</span><span>🔊 Sound effects only</span><span>🎨 Act it as…</span><span>🧊 Freeze frame</span><span>🏃 Relay</span><span>👯 Two-person scene</span></div></section>
            <section class="aol-ticket"><div class="aol-tk">🎟️ BOX OFFICE · ADMIT ALL</div><img id="qr" alt="QR code to join"><div class="aol-url" id="aol-url"></div><div class="aol-cl">ROOM CODE</div><div class="aol-code" id="code"></div>
              <div class="aol-vip" id="aol-vip"></div><div class="aol-err" id="lobby-err"></div><button class="aol-start" id="start">🎬 Raise the curtain</button>
              <div class="aol-links"><button id="add-bots">🤖 + 5 test bots</button><button id="aol-rm">remove bots</button><button id="aol-pick">🎮 Other game</button></div></section>
          </div>
          <div class="aol-cast"><div class="aol-ch">THE CAST <b id="aol-n"></b></div><div class="aol-roster" id="roster"></div></div>
          <div id="aol-lineup"></div>
        </div></div>`;
      el.querySelector('#start').onclick = async () => { const r = await LOBBY.start(); el.querySelector('#lobby-err').textContent = r && r.ok ? '' : (r && r.error) || ''; };
      el.querySelector('#add-bots').onclick = () => LOBBY.bots(5);
      el.querySelector('#aol-rm').onclick = () => LOBBY.removeBots();
      el.querySelector('#aol-pick').onclick = () => LOBBY.pick();
    }
    el.querySelector('#code').textContent = L.code;
    el.querySelector('#aol-url').textContent = (L.joinUrl || '').replace(/^https?:\/\//, '').replace(/\?.*$/, '');
    const q = el.querySelector('#qr'); if (q.dataset.u !== L.qr) { q.src = L.qr; q.dataset.u = L.qr; }
    const set = el.querySelector('#settings'), sig = JSON.stringify([L.settings, L.fields.map((f) => f.key)]);
    if (set.dataset.sig !== sig && !(document.activeElement && document.activeElement.tagName === 'SELECT' && set.contains(document.activeElement))) {
      set.dataset.sig = sig;
      set.innerHTML = L.fields.map((f) => {
        const B = BILL[f.key] || { lab: f.label, opts: {} }, cur = String(L.settings[f.key]);
        return `<div class="aol-row"><div class="aol-lab">${esc(B.lab)}</div><div class="aol-opts">${f.options.map((o) => `<button class="aol-opt ${String(o.value) === cur ? 'on' : ''}" data-k="${esc(f.key)}" data-v="${esc(String(o.value))}" title="${esc(o.label)}">${esc(B.opts[String(o.value)] || o.label)}</button>`).join('')}</div>
          <select data-set="${esc(f.key)}" class="aol-sel" aria-label="${esc(f.label)}">${f.options.map((o) => `<option value="${esc(String(o.value))}" ${String(o.value) === cur ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></div>`;
      }).join('');
      for (const s of set.querySelectorAll('select[data-set]')) s.onchange = () => LOBBY.set(s.dataset.set, s.value);
      for (const b of set.querySelectorAll('[data-k]')) b.onclick = () => { const s = set.querySelector(`select[data-set="${b.dataset.k}"]`); if (s) { s.value = b.dataset.v; s.onchange(); } for (const x of set.querySelectorAll(`[data-k="${b.dataset.k}"]`)) x.classList.toggle('on', x === b); BOX.sfx('pop'); };
    }
    const n = L.players.length;
    el.querySelector('#aol-n').textContent = n ? `(${n})` : '';
    el.querySelector('#aol-vip').innerHTML = L.vip ? `👑 <b>${esc(L.vip)}</b> can start from their phone` : n < L.min ? `${L.min - n} more actor${L.min - n === 1 ? '' : 's'} needed…` : 'Ready when you are!';
    BOX.morph(el.querySelector('#roster'), n ? L.players.map((p, i) => `<span class="chip ${p.online ? '' : 'off'}" style="--c:${esc(p.color || '#ffc93c')};--d:${((i * 0.37) % 2.6).toFixed(2)}s"><span class="hd ${has(p) ? 'has-face' : ''}">${has(p) ? av(p, 66, { fill: true, cls: 'ao-hf' }) : esc(p.avatar || '🙂')}</span><b>${esc(p.name)}</b></span>`).join('') : '<span class="aol-empty">The stage is empty… scan the ticket to join the cast! 🎟️</span>');
    const lu = el.querySelector('#aol-lineup'); if (lu.dataset.h !== (L.lineupHtml || '')) { lu.innerHTML = L.lineupHtml || ''; lu.dataset.h = L.lineupHtml || ''; }
    el.querySelector('#start').disabled = n < (L.min || 1);
  }

  // ---------------- phones ----------------
  const P = { felt: '', picking: false, pickKey: '', hidden: false, lastRes: null, turn: 0, pose: 0, leg: -1 };
  function feel(ctx, key, kind) { if (P.felt === key) return; P.felt = key; ctx.haptic(kind); }
  function head(v) { return `<div class="ao-ph-top"><span>🎭 Scene ${v.n}/${v.of}</span><span>⭐ <b>${v.points}</b></span><span>#${v.rank || '–'} of ${v.count}</span></div>`; }
  function promptCard(v, cls = '') {
    const m = v.mine; if (!m) return '';
    return `<div class="ao-secret ${P.hidden ? 'hid' : ''} ${cls}" id="ao-secret"><small>${esc(m.icon || '🎭')} ${esc(m.catLabel || '')} · ${plural(m.words, 'word')}</small><div class="t">${esc(m.text)}</div><span class="eye">${P.hidden ? '👁️ tap to show' : '🙈 tap to hide'}</span></div>`;
  }
  function twistBox(v) {
    const tw = v.twist || TW.classic;
    return `<div class="ao-ph-tw ${esc(v.kind)}"><span class="ic">${esc(tw.icon)}</span><div><b>${esc(tw.name)}</b><span>${twistLine(v)}</span></div></div>`;
  }
  function bindSecret(el, ctx) { const s = el.querySelector('#ao-secret'); if (s) s.onclick = () => { P.hidden = !P.hidden; ctx.haptic('tap'); ctx.redraw(); }; }
  // The guess box is built once and kept (data-keep), so typing never loses focus or text.
  function guessBox(el, ctx) {
    const box = el.querySelector('#ao-gbox'); if (!box || box.firstChild) return;
    box.innerHTML = `<form class="ao-gform" autocomplete="off"><input id="ao-gin" maxlength="60" placeholder="Type a guess…" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="send"><button class="btn big" type="submit">Guess!</button></form>`;
    const f = box.querySelector('form'), inp = box.querySelector('input');
    f.onsubmit = async (e) => {
      e.preventDefault(); const text = inp.value.trim(); if (!text) { ctx.haptic('error'); return; }
      const r = await ctx.act({ op: 'guess', text });
      if (r && r.ok) {
        inp.value = '';
        if (r.res === 'right') { ctx.haptic('win'); ctx.sfx('win'); } else if (r.res === 'close') { ctx.haptic('select'); ctx.toast('🔥 So close! Keep going…'); } else ctx.haptic('tap');
      }
    };
  }
  function phone(el, v, ctx) {
    // JustGold gear: this game's phone theme, a frame and badge over your screen (public/shared/gear.js).
    if (window.MT_GEAR) window.MT_GEAR.phoneTheme(el, arguments[3], 'actout');
    if (!v) return;
    const turnKey = v.n + ':' + v.phase;
    if (P.turn !== v.n) { P.turn = v.n; P.hidden = false; P.picking = false; P.pose = 0; P.leg = -1; }
    if (v.phase !== 'act') P.picking = false;
    // haptics at the big moments
    if (v.phase === 'cast') feel(ctx, turnKey, v.role === 'actor' ? 'turn' : 'select');
    if (v.phase === 'cue') feel(ctx, turnKey, 'buzz');
    if (v.phase === 'act') feel(ctx, turnKey, v.role === 'actor' ? 'big' : 'tap');
    if (v.phase === 'act' && v.pose && P.pose !== v.pose.n) { if (P.pose && v.role === 'actor') { ctx.haptic('buzz'); ctx.sfx('freeze'); } P.pose = v.pose.n; }
    if (v.phase === 'act' && v.relay && P.leg !== v.relay.leg) { if (v.role === 'actor' && v.relay.id === v.me) { ctx.haptic('turn'); ctx.sfx('whoosh'); } P.leg = v.relay.leg; }
    if (v.phase === 'bravo') feel(ctx, turnKey, v.gain >= 150 ? 'success' : 'select');
    if (v.phase === 'over') feel(ctx, 'over' + v.n, v.rank === 1 ? 'win' : 'success');

    if (v.phase === 'over') return phoneOver(el, v);
    if (v.role === 'watch') return BOX.morph(el, `<div class="ao-ph">${head(v)}<div class="ao-msg"><div class="big">🎟️</div><h3>You’re in from the next scene!</h3><p>Watch the stage on the TV.</p></div></div>`);
    const H = head(v);
    if (v.phase === 'cast') {
      if (v.role === 'actor') {
        const rel = v.kind === 'relay' ? `<p class="ao-note">🏃 You’re runner <b>${v.myLeg + 1}</b> of ${v.cast.length}. ${v.myLeg === 0 ? 'You start!' : 'Wait for your buzz, then take over.'}</p>` : '';
        const sc = v.kind === 'scene' && v.partner ? `<p class="ao-note">👯 Your scene partner is <b>${esc(v.partner.name)}</b>. They have a <b>different</b> secret prompt!</p>` : '';
        const team = v.kind !== 'scene' && v.kind !== 'relay' && v.cast.length > 1 ? `<p class="ao-note">🤝 Act it together with ${castNames(v.cast.filter((c) => c.id !== v.me))}.</p>` : '';
        BOX.morph(el, `<div class="ao-ph actor">${H}<div class="ao-you">🔦 YOU’RE ON STAGE!</div>${twistBox(v)}${promptCard(v)}${rel}${sc}${team}
          <button class="btn big ao-go" id="ao-ready">🎬 I’m ready: ACTION!</button>
          ${v.mine && v.mine.canSkip ? '<button class="btn ghost ao-skip" id="ao-skip">⏭ Skip this prompt <small>(1 skip)</small></button>' : ''}<p class="ao-fine">Starts by itself in ${BOX.timer(v.endsIn)}</p></div>`);
        el.querySelector('#ao-ready').onclick = async () => { const r = await ctx.act({ op: 'ready' }); if (r && r.ok) { ctx.haptic('success'); ctx.sfx('drum'); } };
        bindSkip(el, ctx); bindSecret(el, ctx); return;
      }
      return BOX.morph(el, `<div class="ao-ph">${H}<div class="ao-msg"><div class="big spot">${v.cast.map(av).join('')}</div><h3>${castNames(v.cast)} ${v.cast.length > 1 ? 'are' : 'is'} getting ready…</h3></div>${twistBox(v)}<p class="ao-fine">Get your thumbs ready: type guesses here, or shout them out!</p></div>`);
    }
    if (v.phase === 'cue') return BOX.morph(el, `<div class="ao-ph ${v.role}">${H}<div class="ao-cueph">🎬<b>ACTION!</b></div>${v.role === 'actor' ? promptCard(v) : '<p class="ao-fine">Eyes on the stage!</p>'}</div>`), bindSecret(el, ctx);
    if (v.phase === 'act') return v.role === 'actor' ? actorAct(el, v, ctx, H) : guesserAct(el, v, ctx, H);
    if (v.phase === 'bravo') return phoneBravo(el, v, ctx, H);
    BOX.morph(el, `<div class="ao-ph">${H}</div>`);
  }
  function bindSkip(el, ctx) {
    const b = el.querySelector('#ao-skip'); if (!b) return;
    b.onclick = async () => { const r = await ctx.act({ op: 'skip' }); if (r && r.ok) { ctx.haptic('tap'); ctx.sfx('whoosh'); P.hidden = false; ctx.toast('⏭ New prompt!'); } };
  }
  function actorAct(el, v, ctx, H) {
    const m = v.mine || {};
    if (P.picking && !m.solved) {
      BOX.morph(el, `<div class="ao-ph actor">${H}<h3 class="ao-pickh">✅ Who got it?</h3><div class="ao-picks">${(v.choices || []).map((c) => `<button class="ao-pick" data-id="${esc(c.id)}" style="--c:${esc(c.color)}"><span>${av(c, 44)}</span>${esc(c.name)}</button>`).join('')}</div><button class="btn ghost ao-skip" id="ao-cancel">◀ Not yet, keep acting</button></div>`);
      for (const b of el.querySelectorAll('[data-id]')) b.onclick = async () => { const r = await ctx.act({ op: 'got', id: b.dataset.id }); if (r && r.ok) { P.picking = false; ctx.haptic('win'); ctx.sfx('cheer'); ctx.redraw(); } };
      el.querySelector('#ao-cancel').onclick = () => { P.picking = false; ctx.haptic('tap'); ctx.redraw(); };
      return;
    }
    let status = '';
    if (v.relay) {
      const on = v.relay.id === v.me, mine = v.myLeg, nextC = v.cast[v.relay.leg + 1];
      status = on ? `<div class="ao-relay on">🔦 YOU’RE ON! <span>${BOX.timer(v.relay.legEndsIn)}</span>${nextC ? `<button class="btn ao-pass" id="ao-pass">Pass ➡ ${esc(nextC.name)}</button>` : '<small>Last runner: bring it home!</small>'}</div>`
        : mine > v.relay.leg ? `<div class="ao-relay">⏳ You’re up ${mine === v.relay.leg + 1 ? 'next' : `after ${esc(v.cast[mine - 1].name)}`}… watch and stay quiet!</div>` : '<div class="ao-relay done">✓ Your leg is done. Zip it! 🤐</div>';
    }
    if (v.kind === 'scene' && v.partner) status += `<p class="ao-note">👯 Scene partner: <b>${esc(v.partner.name)}</b> (a different secret prompt). Play off each other!</p>`;
    if (v.pose) status +=`<div class="ao-phpose" id="ao-phpose-${v.pose.n}">🧊 POSE <b>${v.pose.n}</b> / ${v.pose.of}<small>${v.pose.n < v.pose.of ? 'Hold it! New pose on the next buzz.' : 'Last pose: make it count!'}</small></div>`;
    const solvedAll = v.prompts.every((p) => p.solved || p.gone);
    BOX.morph(el, `<div class="ao-ph actor">${H}${m.solved ? `<div class="ao-done">🎉 They got it!</div>` : ''}${promptCard(v, m.solved ? 'won' : '')}<div class="ao-rule">${esc((v.twist || TW.classic).icon)} ${twistLine(v)}</div>${status}
      ${m.solved || solvedAll ? '' : '<button class="btn big ao-go" id="ao-got">✅ They got it!</button>'}
      ${m.canSkip && !m.solved ? '<button class="btn ghost ao-skip" id="ao-skip">⏭ Skip <small>(1 left)</small></button>' : ''}
      <p class="ao-fine">⏱ ${BOX.timer(v.endsIn)} · someone shouted it? Tap ✅ and pick who.</p></div>`);
    const g = el.querySelector('#ao-got'); if (g) g.onclick = () => { P.picking = true; ctx.haptic('select'); ctx.redraw(); };
    const ps = el.querySelector('#ao-pass'); if (ps) ps.onclick = async () => { const r = await ctx.act({ op: 'pass' }); if (r && r.ok) ctx.haptic('success'); };
    bindSkip(el, ctx); bindSecret(el, ctx);
  }
  function guesserAct(el, v, ctx, H) {
    const scene = v.kind === 'scene', open = v.prompts.filter((p) => !p.solved && !p.gone);
    const mineRight = v.solvedByMe && v.solvedByMe.length;
    const clues = v.prompts.map((p) => `<div class="ao-phclue ${p.solved ? 'solved' : ''}">${scene ? `<i>${'AB'[p.k]}</i>` : ''}<span class="ic">${esc(p.icon)}</span><span><b>${esc(p.catLabel)}</b><small>${p.solved ? `✅ ${esc(p.text)} · ${esc(p.solved.name)}` : plural(p.words, 'word')}</small></span></div>`).join('');
    const mine = (v.myGuesses || []).slice().reverse().map((g) => `<li class="${g.res}"><span>${esc(g.text)}</span><b>${g.res === 'right' ? '✅' : g.res === 'close' ? '🔥 close' : '✗'}</b></li>`).join('');
    const who = scene ? `${castNames(v.cast)}’s scene` : `${castNames(v.cast)} ${v.cast.length > 1 ? 'are' : 'is'} acting`;
    BOX.morph(el, `<div class="ao-ph guess">${H}<div class="ao-acting"><span class="avs">${v.cast.map(av).join('')}</span><span>${who}${v.style ? ` <b>${esc(v.style.icon)} ${esc(v.style.label)}</b>` : ''}</span><span class="tm">${BOX.timer(v.endsIn)}</span></div>
      <div class="ao-phclues">${clues}</div>
      ${mineRight ? `<div class="ao-done">🎉 You got it! <small>+points when the scene ends</small></div>` : ''}
      ${open.length ? `<div class="ao-gbox" id="ao-gbox" data-keep></div>${scene ? '<p class="ao-fine">One guess box for both prompts: we’ll check it against each.</p>' : ''}` : `<div class="ao-done">🎉 Solved!</div>`}
      ${mine ? `<ul class="ao-mine">${mine}</ul>` : '<p class="ao-fine">Typos are fine: we match close spellings, plurals and synonyms.</p>'}</div>`);
    if (open.length) guessBox(el, ctx);
  }
  function phoneBravo(el, v, ctx, H) {
    const rev = v.prompts.map((p) => `<div class="ao-rev ${p.solved ? 'yes' : 'no'}"><small>${esc(p.icon)} ${esc(p.catLabel)}</small><b>${esc(p.text || '')}</b><span>${p.solved ? `✅ ${esc(p.solved.name)} · ${secs(p.solved.ms)}` : '⏰ Nobody got it'}</span></div>`).join('');
    const why = [...new Set(v.why || [])].map((w) => ({ guess: '🔮 right guess', act: '🎭 they got your act', clap: '👏 applause' }[w])).filter(Boolean).join(' · ');
    const gain = v.gain ? `<div class="ao-gainph">+${v.gain}<small>${why}</small></div>` : '';
    if (v.role === 'actor') {
      return BOX.morph(el, `<div class="ao-ph actor">${H}${rev}${gain}<div class="ao-claps"><span>👏</span><b>${v.clapsForMe || 0}</b><small>applause so far</small></div><p class="ao-fine">Take a bow! 🙇</p></div>`);
    }
    const cast = v.cast;
    BOX.morph(el, `<div class="ao-ph">${H}${rev}${gain}
      <h3 class="ao-pickh">${v.myClap ? '👏 Bravo! Thanks for clapping.' : 'Best performance? 👏'}</h3>
      <div class="ao-clapbtns n${cast.length}">${cast.map((c) => `<button class="ao-clapbtn ${v.myClap === c.id ? 'on' : ''}" data-clap="${esc(c.id)}" ${v.myClap ? 'disabled' : ''} style="--c:${esc(c.color)}"><span class="h">👏</span><span>${av(c)} ${esc(c.name)}</span></button>`).join('')}</div>
      <p class="ao-fine">Each 👏 is +25 for the actor. Next scene in ${BOX.timer(v.endsIn)}</p></div>`);
    for (const b of el.querySelectorAll('[data-clap]')) b.onclick = async () => { const r = await ctx.act({ op: 'clap', id: b.dataset.clap }); if (r && r.ok) { ctx.haptic('success'); ctx.sfx('cheer'); } };
  }
  function phoneOver(el, v) {
    const f = v.final || { top: [], awards: [], mine: [] };
    BOX.morph(el, `<div class="ao-ph ao-end"><div class="ao-place">${v.rank === 1 ? '🏆' : v.rank === 2 ? '🥈' : v.rank === 3 ? '🥉' : '🎭'}</div><h2>${v.rank === 1 ? 'Best in show!' : `You finished #${v.rank}`}</h2><p class="ao-big">⭐ ${v.points}</p>
      ${f.mine.length ? f.mine.map((a) => `<div class="ao-myaward"><span>${esc(a.icon)}</span><div><b>${esc(a.title)}</b><small>${esc(a.why)}</small></div></div>`).join('') : '<p class="ao-fine">No statue this time… there’s always the sequel. 🎬</p>'}
      <div class="ao-top5">${f.top.map((r, i) => `<div><span>${i + 1}. ${av(r)} ${esc(r.name)}</span><b>${r.points}</b></div>`).join('')}</div></div>`);
  }

  BOX.games.actout = {
    name: 'Act It Out', icon: '🎭', lobbyTv,
    about: 'Charades with a twist: act out a secret prompt while the room guesses on their phones. Silent movies, freeze frames, relays and two-person scenes!',
    how: [
      'Each scene, one actor (or a pair in big rooms) gets a secret prompt on their phone and acts it out in the room.',
      'Everyone else types guesses on their phone (typos and synonyms count) or shouts them out: the actor taps ✅ They got it! and picks who.',
      'The first right guess and the actor score 100 + up to 100 for speed. Twist scenes give the actor +50.',
      'Twists: 🎞️ Silent movie, 🔊 Sound effects only, 🎨 Act it as… a style, 🧊 Freeze frame, 🏃 Relay, 👯 Two-person scene.',
      'After each scene, applaud the best performance: every 👏 is +25 for the actor. The final scene counts double.',
      'Most points wins, and the awards night hands out the Oscar-worthy, Mime Master and more.',
    ],
    // got / clap play a recorded audience instead, and the cue gets a real clapperboard (onFx below).
    fx: { start: 'start', cast: 'whoosh', final: 'sting', cue: 'drum', action: 'bell', reveal: 'reveal', nobody: 'shrug', skip: 'whoosh', pose: 'freeze', baton: 'whoosh', win: 'win' },
    onFx(f) {
      // LIGHTS… CAMERA… ACTION!: the 🎬 snaps shut (aoSnap, 60-66% of 2.6 s) as ACTION! lands (1.7 s).
      if (f.kind === 'cue') rec('clapper', { vol: 0.3, delay: 1.6 });
      if (f.kind === 'got') rec('cheer', { vol: 0.16 }); // someone guessed it: the house cheers
      if (f.kind === 'clap') rec('applause', { vol: 0.16, pan: Math.random() * 0.6 - 0.3, gap: 900 }); // 👏 for the actor
    },
    // Soundtrack cue per phase (public/box/scores/actout.js); the TV turns the last 10 s of 'think' tense.
    music(s) { if (!s) return 'play'; return { cast: 'play', cue: 'tense', act: 'think', bravo: 'reveal', over: 'finale' }[s.phase] || 'play'; },
    tv, phone,
  };
})();
