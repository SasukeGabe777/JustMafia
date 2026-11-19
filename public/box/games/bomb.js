'use strict';
// Bomb Squad screens. TV: the bomb-disposal bay: a big cartoon bomb with a burning fuse, an LED
// countdown, strike lamps and module lights (one bomb per squad, side by side for big groups),
// then KA-BLAM! or DEFUSED and a mission report. Phone: the DEFUSER gets the bomb (plate, one
// module at a time, the radio), EXPERTS get their pages of the field manual. BOX.morph everywhere.
(function () {
  const { esc } = BOX;
  const COL = { red: '#ff4a3d', blue: '#3a8bff', yellow: '#ffd23f', green: '#3ccf6e', white: '#f4f1e8', black: '#2a2a32', purple: '#9b5cff', orange: '#ff8a2a', teal: '#19c3b3', pink: '#ff6fb5' };
  const SHAPE = { triangle: '▲', circle: '●', square: '■', diamond: '◆' };
  const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);
  const av = (x) => esc((x && x.avatar) || '🙂');
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const haptic = (ctx, kind) => { try { if (ctx && ctx.haptic) ctx.haptic(kind); } catch { /* none */ } };
  let felt = {};
  const feel = (ctx, chan, key, kind) => { if (felt[chan] === key) return; felt[chan] = key; haptic(ctx, kind); };

  // ---------- the countdown: fixed end times, a 10 Hz ticker, the fuse burns down ----------
  const ends = {};
  const endAt = (key, endsIn) => { if (!(key in ends)) ends[key] = Date.now() + endsIn; return ends[key]; };
  const fmt = (ms) => { ms = Math.max(0, ms); if (ms < 10000) return (Math.floor(ms / 100) / 10).toFixed(1); const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const clock = (key, endsIn, live) => (live ? `<span class="bs-clock ${endsIn < 10000 ? 'hot' : ''}" data-bs-end="${endAt(key, endsIn)}">${fmt(endsIn)}</span>` : `<span class="bs-clock">${fmt(endsIn)}</span>`);
  let isTV = false, lastTick = -1;
  const FUSE_D = 'M200 92 C 196 46, 236 22, 276 38 S 330 70, 352 30';
  function burnFuse(bomb, frac) {
    const p = bomb.querySelector('.bs-fuse'), sp = bomb.querySelector('.bs-spark'); if (!p || !sp) return;
    try { const L = p.getTotalLength(), pt = p.getPointAtLength(L * Math.max(0, Math.min(1, frac))); p.style.strokeDashoffset = String(100 - frac * 100); sp.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`); } catch { /* not laid out */ }
  }
  setInterval(() => {
    let min = Infinity;
    for (const el of document.querySelectorAll('[data-bs-end]')) {
      const left = Number(el.dataset.bsEnd) - Date.now(); el.textContent = fmt(left);
      el.classList.toggle('hot', left < 10000); min = Math.min(min, left);
    }
    for (const b of document.querySelectorAll('.bs-bomb[data-end]')) {
      const left = Number(b.dataset.end) - Date.now(), tot = Number(b.dataset.total) || 1;
      burnFuse(b, left / tot); b.classList.toggle('hot', left < 10000);
    }
    if (isTV && min > 0 && min < 10200) { const s = Math.ceil(min / 1000); if (s !== lastTick) { lastTick = s; BOX.sfx('tick'); } }
    // the signal lamp flashes its sequence (phone)
    for (const L of document.querySelectorAll('.bs-signal[data-seq]')) {
      const seq = L.dataset.seq.split(','), step = 950, cyc = seq.length * step + 1700, t = Date.now() % cyc, i = Math.floor(t / step), on = i < seq.length && t % step < 650;
      const c = on ? COL[seq[i]] || '#fff' : '';
      if (L._c !== c) { L._c = c; L.style.setProperty('--lc', c || '#3a3a44'); L.classList.toggle('on', on); }
      const dots = L.parentNode && L.parentNode.querySelectorAll('.bs-sdot');
      if (dots) dots.forEach((d, k) => d.classList.toggle('on', on && k === i));
    }
    // the plunger's pressure gauge while it's held
    if (hold) { const g = document.getElementById('bs-gauge'), n = gaugeAt(Date.now() - hold.t0); if (g && g.textContent !== String(n || '·')) { g.textContent = String(n || '·'); if (n) haptic(hold.ctx, 'tap'); } const pl = document.getElementById('bs-plunger'); if (pl) pl.classList.toggle('held', n > 0); }
  }, 100);

  // Paint into a root whose id changes per moment, so entrance animations play once per moment.
  function paint(el, html, key) {
    const fresh = el._bsKey !== key; el._bsKey = key;
    if (!fresh && el._bsHtml === html) return false;
    el._bsHtml = html;
    BOX.morph(el, `<div class="bs-root" id="bs-${esc(key)}">${html}</div>`);
    return fresh;
  }

  // ---------- the cartoon bomb (TV) ----------
  function bombArt(b, key, size) {
    const live = b.status === 'live' && b.endsIn > 0, total = (b.secs || 1) * 1000;
    const frac = b.status === 'live' ? (b.endsIn || total) / total : b.status === 'defused' ? Math.max(0.05, (b.left || 0) / total) : 0;
    const L = 100, pt = 100 - frac * L;
    const end = live ? endAt(key, b.endsIn) : 0;
    const strikes = [0, 1, 2].map((i) => `<i class="${i < b.strikes ? 'on' : ''}">✖</i>`).join('');
    const led = b.status === 'defused' ? '<span class="bs-clock safe">SAFE</span>' : b.status === 'boom' ? '<span class="bs-clock">0.0</span>' : clock(key, b.endsIn || total, live);
    return `<div class="bs-bomb st-${b.status} ${size || ''}" ${live ? `data-end="${end}" data-total="${total}"` : ''} id="bb-${esc(key)}-${b.strikes}">
      <svg class="bs-art" viewBox="0 0 400 400" aria-hidden="true">
        <defs><radialGradient id="bsg" cx="38%" cy="34%" r="70%"><stop offset="0" stop-color="#6b6f80"/><stop offset="0.35" stop-color="#2c2e38"/><stop offset="1" stop-color="#0c0c12"/></radialGradient></defs>
        <ellipse cx="200" cy="372" rx="130" ry="18" fill="rgba(0,0,0,.35)"/>
        <circle cx="200" cy="232" r="140" fill="url(#bsg)" stroke="#07070a" stroke-width="8"/>
        <ellipse cx="148" cy="172" rx="42" ry="26" fill="rgba(255,255,255,.18)" transform="rotate(-35 148 172)"/>
        <rect x="160" y="76" width="80" height="36" rx="8" fill="#3b3e4a" stroke="#07070a" stroke-width="7"/>
        <path d="${FUSE_D}" fill="none" stroke="#1a120a" stroke-width="13" stroke-linecap="round"/>
        <path class="bs-fuse" d="${FUSE_D}" pathLength="100" fill="none" stroke="#d9b27a" stroke-width="8" stroke-linecap="round" stroke-dasharray="100 100" style="stroke-dashoffset:${pt}"/>
        <g class="bs-spark" ${b.status === 'live' ? '' : 'style="display:none"'}><circle r="22" fill="rgba(255,190,60,.35)"/><path d="M0-20 L5-5 L20 0 L5 5 L0 20 L-5 5 L-20 0 L-5-5Z" fill="#ffe36b"/><circle r="6" fill="#fff"/></g>
        <rect x="70" y="268" width="260" height="22" rx="4" fill="#c8a04a" stroke="#07070a" stroke-width="5"/>
      </svg>
      <div class="bs-panel"><div class="bs-led">${led}</div><div class="bs-strikes">${strikes}</div></div>
      ${b.status === 'live' && b.radio ? '<div class="bs-radio-alert">📻 RADIO!</div>' : ''}
    </div>`;
  }
  const modRow = (b) => `<div class="bs-modrow">${b.mods.map((m) => `<div class="bs-mod ${m.solved ? 'ok' : ''}"><span class="ic">${esc(m.icon)}</span><span class="nm">${esc(m.name)}</span><i class="lamp"></i></div>`).join('')}${b.needy ? `<div class="bs-mod needy ${b.radio ? 'ping' : ''}"><span class="ic">📻</span><span class="nm">Radio</span><i class="lamp"></i></div>` : ''}</div>`;
  const people = (list, cls) => list.map((p) => `<span class="bs-pp ${cls || ''}" style="--c:${esc(p.color || '#888')}"><span class="f">${av(p)}</span><b>${esc(p.name)}</b></span>`).join('');
  const logLine = (b) => (b.log ? `<div class="bs-log k-${esc(b.log.kind)}" id="bl-${b.log.n}">${b.log.kind === 'strike' ? '✖ ' : b.log.kind === 'solve' ? '✔ ' : b.log.kind === 'radio' ? '📻 ' : ''}${esc(b.log.text)}</div>` : '<div class="bs-log quiet">Talk it out…</div>');

  function tvBrief(s) {
    const sq = s.squads, first = sq[0] && sq[0].bomb;
    const mods = first ? first.mods : [];
    return `<div class="bs-brief">
      <div class="bs-incoming"><span class="bs-hz"></span><b>INCOMING · BOMB ${s.round} OF ${s.of}</b><span class="bs-hz"></span></div>
      <div class="bs-specs"><span>🧩 ${plural(s.mods, 'module')}</span><span>⏱ ${fmt(s.secs * 1000)} on the clock</span>${s.needy ? '<span class="needy">📻 Needy radio!</span>' : ''}<span>Arming in ${BOX.timer(s.endsIn)}</span></div>
      <div class="bs-preview">${mods.map((m) => `<div class="bs-crate"><span>${esc(m.icon)}</span><b>${esc(m.name)}</b></div>`).join('')}${s.needy ? '<div class="bs-crate needy"><span>📻</span><b>Radio Check</b></div>' : ''}</div>
      <div class="bs-teams n${sq.length}">${sq.map((q) => `<div class="bs-team" style="--sq:${esc(q.color)}">
        ${sq.length > 1 ? `<div class="bs-tname">${esc(q.name)} squad</div>` : ''}
        <div class="bs-defs">${q.defusers.map((d) => `<div class="bs-def"><div class="bs-hat">⛑️</div><div class="bs-face">${av(d)}</div><b>${esc(d.name)}</b><small>DEFUSER</small></div>`).join('')}</div>
        <div class="bs-exps"><small>📖 Experts with the manual</small><div>${people(q.experts) || '<span class="muted">None: the defuser gets the manual!</span>'}</div></div></div>`).join('')}</div>
      <div class="bs-tip">${s.round === 1 ? 'Defusers: describe your bomb out loud. Experts: read your pages and ask questions!' : s.needy ? 'The radio will crackle for a callsign. Whoever holds the Radio page: be ready!' : 'New defusers this round. Swap seats if you need to!'}</div>
    </div>`;
  }
  function tvTick(s) {
    const sq = s.squads;
    if (sq.length === 1) {
      const q = sq[0], b = q.bomb;
      return `<div class="bs-bay one">
        <div class="bs-stage">${bombArt(b, `${s.round}-${q.id}`, 'big')}${modRow(b)}</div>
        <aside class="bs-side">
          <div class="bs-card"><small>🧤 Hands on the bomb</small><div class="bs-plist">${people(q.defusers, 'def')}</div></div>
          <div class="bs-card"><small>📖 Reading the manual</small><div class="bs-plist">${people(q.experts) || '<span class="muted">The defuser has the manual</span>'}</div></div>
          ${logLine(b)}
          <div class="bs-score"><small>TEAM SCORE</small><b>${s.team}</b></div>
        </aside></div>`;
    }
    return `<div class="bs-bay many n${sq.length}">${sq.map((q) => `<div class="bs-cell st-${q.bomb.status}" style="--sq:${esc(q.color)}">
      <div class="bs-tname">${esc(q.name)} squad</div>
      <div class="bs-cbody">${bombArt(q.bomb, `${s.round}-${q.id}`, 'small')}<div class="bs-cinfo">
      <div class="bs-cdefs">🧤 ${q.defusers.map((d) => `${av(d)} ${esc(d.name)}`).join(' · ')}</div>
      ${modRow(q.bomb)}${logLine(q.bomb)}</div></div></div>`).join('')}</div>`;
  }
  function blast(big) {
    const pts = []; for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2, r = i % 2 ? 92 : 190 - (i % 4) * 12; pts.push(`${(200 + Math.cos(a) * r).toFixed(0)},${(200 + Math.sin(a) * r).toFixed(0)}`); }
    const pts2 = []; for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2 + 0.2, r = i % 2 ? 60 : 125; pts2.push(`${(200 + Math.cos(a) * r).toFixed(0)},${(200 + Math.sin(a) * r).toFixed(0)}`); }
    return `<div class="bs-blast ${big ? 'big' : ''}"><div class="bs-smoke"><i></i><i></i><i></i><i></i><i></i></div>
      <svg viewBox="0 0 400 400"><polygon points="${pts.join(' ')}" fill="#ff7a1a" stroke="#2a0d00" stroke-width="8"/><polygon points="${pts2.join(' ')}" fill="#ffe14d"/></svg>
      <div class="bs-kablam">KA-BLAM!</div><div class="bs-bits">${'<i></i>'.repeat(10)}</div></div>`;
  }
  function tvReveal(s) {
    const sq = s.squads, any = sq.some((q) => q.bomb.status === 'defused'), all = sq.every((q) => q.bomb.status === 'defused');
    const head = all ? (sq.length > 1 ? 'EVERY BOMB DEFUSED!' : 'BOMB DEFUSED!') : any ? 'SOME OF US MADE IT…' : sq.length > 1 ? 'EVERY BOMB WENT OFF!' : 'THE BOMB WENT OFF!';
    return `<div class="bs-reveal ${all ? 'win' : any ? 'mixed' : 'lose'}">
      <h1 class="bs-rh">${head}</h1>
      <div class="bs-results n${sq.length}">${sq.map((q, i) => {
        const b = q.bomb, ok = b.status === 'defused';
        return `<div class="bs-res ${ok ? 'ok' : 'boom'}" style="--sq:${esc(q.color)};--d:${(0.3 + i * 0.5).toFixed(1)}s">
          ${sq.length > 1 ? `<div class="bs-tname">${esc(q.name)} squad</div>` : ''}
          <div class="bs-resart">${ok ? `${bombArt(b, 'r' + s.round + '-' + q.id, sq.length > 1 ? 'small' : 'mid')}<div class="bs-check">✔</div>` : blast(sq.length === 1)}</div>
          <div class="bs-resline">${ok ? `Defused with <b>${fmt(b.left)}</b> to spare${b.strikes ? ` · ${plural(b.strikes, 'strike')}` : ' · no strikes!'}` : b.why === 'strikes' ? 'Three strikes and it blew!' : b.why === 'host' ? 'The fuse was cut short.' : 'The clock hit zero!'}</div>
          <div class="bs-resmods">${b.mods.filter((m) => m.solved).length}/${b.mods.length} modules safe · <b>+${q.gained}</b> pts for the squad</div>
        </div>`;
      }).join('')}</div>
      <div class="bs-tally"><span>TEAM SCORE</span><b>${s.team}</b><small>${s.round < s.of ? `Next: bomb ${s.round + 1} of ${s.of}, new defusers` : 'Mission report next…'}</small></div>
    </div>`;
  }
  const AWARDS = [['hands', '🧤', 'Steadiest Hands', (a) => `${plural(a.value, 'module')} defused`], ['reader', '📖', 'Page Turner', (a) => `${plural(a.value, 'assist')} from the manual`], ['cool', '🧊', 'Ice Cool', (a) => `${plural(a.value, 'bomb')} defused as the defuser`], ['oops', '🙈', 'Butterfingers', (a) => `${plural(a.value, 'strike')} (we still love you)`]];
  const awardsHtml = (aw) => `<div class="bs-awards">${AWARDS.filter(([k]) => aw && aw[k]).map(([k, ic, lb, txt], i) => `<div class="bs-award" style="animation-delay:${(0.5 + i * 0.3).toFixed(1)}s"><div class="ic">${ic}</div><div class="lb">${lb}</div><div class="nm">${aw[k].names.map(esc).join(', ')}</div><small>${txt(aw[k])}</small></div>`).join('')}</div>`;
  function tvOver(s) {
    const f = s.final || {}, rows = s.standings || [];
    const rank = f.played ? f.defused / f.played : 0;
    const grade = rank >= 1 ? ['🏅', 'FLAWLESS SQUAD'] : rank >= 0.75 ? ['🎖️', 'DECORATED'] : rank >= 0.5 ? ['🪖', 'ON PROBATION'] : rank > 0 ? ['🧯', 'SINGED BUT SMILING'] : ['💥', 'CRATER ENTHUSIASTS'];
    return `<div class="bs-over">
      <div class="bs-report"><div class="bs-stamp">${grade[0]} ${grade[1]}</div>
        <h1>MISSION REPORT</h1>
        <div class="bs-big"><div><small>TEAM SCORE</small><b>${f.team || 0}</b></div><div><small>BOMBS DEFUSED</small><b>${f.defused || 0}<span>/${f.played || 0}</span></b></div></div>
        ${f.squads && f.squads.length > 1 ? `<div class="bs-sqs">${f.squads.map((q) => `<span style="--sq:${esc(q.color)}"><b>${esc(q.name)}</b> ${q.defused} defused · ${q.total} pts</span>`).join('')}</div>` : ''}
        ${awardsHtml(f.awards)}</div>
      <div class="bs-board"><h3>Who held it together</h3>${rows.map((r, i) => `<div class="bs-brow" style="--c:${esc(r.color || '#888')};animation-delay:${(0.2 + i * 0.08).toFixed(2)}s"><span class="n">${i === 0 ? '🏆' : i + 1}</span><span class="f">${av(r)}</span><span class="nm">${esc(r.name)}</span><small>🧤${r.solves} 📖${r.assists}</small><b>${r.points}</b></div>`).join('')}</div>
    </div>`;
  }

  // ---------- phone ----------
  let sel = null, selKey = '', pg = 0, pgKey = '', armed = null, dial = [], dialKey = '', hold = null;
  const gaugeAt = (dt) => (dt < 600 ? 0 : 1 + (Math.floor((dt - 600) / 1000) % 6));
  function plateHtml(pl) {
    return `<div class="bs-plate"><div class="bp-sn"><small>SERIAL</small><b>${esc(pl.serial)}</b></div>
      <div class="bp-bt"><small>BATTERIES</small><b>${'🔋'.repeat(pl.batteries) || '<span class="none">none</span>'}<em>${pl.batteries}</em></b></div>
      <div class="bp-sk"><small>STICKER</small><b><i style="background:${COL[pl.sticker]}"></i>${cap(pl.sticker)}</b></div>
      <div class="bp-spk ${pl.spark ? 'on' : ''}"><small>SPARK</small><b><i></i>${pl.spark ? 'ON' : 'off'}</b></div></div>`;
  }
  function modUi(m) {
    if (m.solved) return `<div class="bs-safe"><div>✔</div><b>${esc(m.name)} is safe!</b><small>Pick another module above.</small></div>`;
    switch (m.type) {
      case 'wires': {
        const a = armed && armed.mod === m.id ? armed.wire : null;
        return `<div class="bs-wires">${m.wires.map((c, i) => { const cut = m.cut.includes(i); return `<button class="bs-wire ${cut ? 'cut' : ''} ${a === i ? 'armed' : ''}" data-wire="${i}" ${cut ? 'disabled' : ''}><span class="no">${i + 1}</span><span class="ln" style="--w:${COL[c]}"><i></i><i></i></span><span class="cl">${cap(c)}</span></button>`; }).join('')}</div>
          ${a != null ? `<button class="btn big bs-cutgo" id="bs-cutgo">✂️ CUT line ${a + 1} (${cap(m.wires[a])})</button>` : '<p class="bs-hint">Tap a line to pick it, then confirm the cut.</p>'}`;
      }
      case 'plunger': {
        const held = hold && hold.mod === m.id ? gaugeAt(Date.now() - hold.t0) : 0;
        return `<div class="bs-plwrap"><div class="bs-strip ${held ? 'lit' : ''}" style="--s:${COL[m.strip]}"></div>
          <button class="bs-plunger ${held ? 'held' : ''}" id="bs-plunger" data-pl="${m.id}" style="--cap:${COL[m.cap]}"><span>${esc(m.label)}</span></button>
          <div class="bs-gaugebox"><small>GAUGE</small><b id="bs-gauge">${held || '·'}</b></div></div>
          <p class="bs-hint">${cap(m.cap)} cap · label <b>${esc(m.label)}</b>. Tap = quick press. Hold it down to light the strip and run the gauge.</p>`;
      }
      case 'glyphs': return `<div class="bs-pad">${m.keys.map((g, i) => `<button class="bs-key ${m.pressed.includes(i) ? 'on' : ''}" data-key="${i}" ${m.pressed.includes(i) ? 'disabled' : ''}><span>${esc(g)}</span><i></i></button>`).join('')}</div><p class="bs-hint">${m.pressed.length}/4 pressed. Press all four in the right order.</p>`;
      case 'maze': {
        const cells = []; for (let c = 0; c < 25; c++) cells.push(`<div class="bs-cellm ${c === m.pos ? 'me' : ''}">${c === m.pos ? '✨' : c === m.exit ? '🚪' : c === m.star ? '★' : ''}${c === m.star && c !== m.pos ? '' : ''}</div>`);
        return `<div class="bs-mazewrap"><div class="bs-maze">${cells.join('')}</div>
          <div class="bs-arrows"><button data-dir="u" class="u">▲</button><button data-dir="l" class="l">◀</button><button data-dir="r" class="r">▶</button><button data-dir="d" class="d">▼</button></div></div>
          <p class="bs-hint">Tell your expert where the ★ is (row and column). Walls are invisible: bump one and it’s a strike!</p>`;
      }
      case 'dial': {
        if (dialKey !== 'm' + m.id) { dialKey = 'm' + m.id; dial = []; }
        return `<div class="bs-dial"><div class="bs-word">${[...m.word].map((c) => `<b>${esc(c)}</b>`).join('')}</div>
          <div class="bs-slots">${[0, 1, 2].map((i) => `<span class="${dial[i] != null ? 'on' : ''}">${dial[i] != null ? dial[i] : '_'}</span>`).join('')}</div>
          <div class="bs-ring">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => `<button data-dig="${d}" ${dial.length >= 3 ? 'disabled' : ''}>${d}</button>`).join('')}</div>
          <div class="bs-dialgo"><button class="btn ghost" id="bs-dclr">⌫ Clear</button><button class="btn big green" id="bs-dgo" ${dial.length === 3 ? '' : 'disabled'}>🔓 Try code</button></div></div>`;
      }
      case 'lamps': return `<div class="bs-lamps"><div class="bs-sigwrap"><div class="bs-signal" data-seq="${esc(m.seq.join(','))}"></div><div class="bs-sdots">${m.seq.map(() => '<i class="bs-sdot"></i>').join('')}</div></div>
          <div class="bs-progress">${m.seq.map((_, i) => `<i class="${i < m.done ? 'on' : ''}"></i>`).join('')}</div>
          <div class="bs-shapes">${Object.entries(SHAPE).map(([k, g]) => `<button data-shape="${k}"><span>${g}</span><small>${cap(k)}</small></button>`).join('')}</div></div>
          <p class="bs-hint">The lamp flashes ${m.seq.length} colours, then pauses and repeats. Read them out!</p>`;
      default: return '';
    }
  }
  function pageHtml(x) {
    let body = x.lines.map((l) => `<p>${esc(l)}</p>`).join('');
    if (x.table) body += `<table class="bs-tbl"><tr>${x.table[0].map((h) => `<th>${esc(h)}</th>`).join('')}</tr>${x.table.slice(1).map((r) => `<tr>${r.map((c, i) => `<td>${i === 0 && COL[String(c).toLowerCase()] ? `<i class="sw" style="background:${COL[String(c).toLowerCase()]}"></i>` : ''}${esc(c)}</td>`).join('')}</tr>`).join('')}</table>`;
    if (x.glyphs) body += `<div class="bs-gl">${x.glyphs.slice().sort((a, b) => a[1] - b[1]).map(([g, v]) => `<span><b>${esc(g)}</b><em>${v}</em></span>`).join('')}</div>`;
    if (x.letters) body += `<div class="bs-lt">${x.letters.map(([l, v]) => `<span><b>${esc(l)}</b><em>${v}</em></span>`).join('')}</div>`;
    if (x.maps) body += `<div class="bs-maps">${x.maps.map((mp) => `<div class="bs-map"><small>MAP ${mp.n}</small><div class="g">${mp.walls.map((w, c) => `<i class="${w & 1 ? 't' : ''} ${w & 2 ? 'r' : ''} ${w & 4 ? 'b' : ''} ${w & 8 ? 'l' : ''}">${c === mp.star ? '★' : ''}</i>`).join('')}</div></div>`).join('')}</div>`;
    return `<div class="bs-page ${x.done ? 'done' : ''}"><div class="bs-ph"><span>${esc(x.icon)} ${esc(x.name)}</span><em>${x.part === 'A' ? 'PART 1' : 'PART 2'}</em></div>
      <h3>${esc(x.title)}</h3>${x.done ? '<div class="bs-donestamp">✔ SOLVED</div>' : ''}${body}
      ${x.with && x.with.length ? `<div class="bs-with">🤝 The other half: <b>${x.with.map(esc).join(', ')}</b></div>` : ''}</div>`;
  }
  function pagesUi(pages, key) {
    if (!pages.length) return '<div class="bs-safe"><b>No pages for you this bomb.</b></div>';
    if (pgKey !== key) { pgKey = key; pg = 0; }
    pg = Math.min(pg, pages.length - 1);
    return `${pages.length > 1 ? `<div class="bs-tabs">${pages.map((x, i) => `<button class="${i === pg ? 'on' : ''} ${x.done ? 'done' : ''}" data-pg="${i}">${esc(x.icon)}<small>${x.part === 'A' ? '1' : '2'}</small></button>`).join('')}</div>` : ''}${pageHtml(pages[pg])}`;
  }
  function head(v, extra) {
    const b = v.bomb, key = `${v.round}-${v.squad ? v.squad.name : ''}-${b ? b.strikes : 0}`;
    const live = b && b.status === 'live' && v.phase === 'tick';
    return `<div class="bs-head ${v.role}" style="--sq:${esc((v.squad && v.squad.color) || '#ffd23f')}"><div class="r">${v.role === 'defuser' ? '🧤 DEFUSER' : '📖 EXPERT'}${v.squad && v.squad.n > 1 ? `<small>${esc(v.squad.name)}</small>` : ''}</div>
      <div class="t">${b ? (live ? clock('p' + key, b.endsIn, true) : b.status === 'defused' ? '<span class="bs-clock safe">SAFE</span>' : `<span class="bs-clock">${fmt(b.endsIn || v.secs * 1000)}</span>`) : ''}</div>
      <div class="x">${[0, 1, 2].map((i) => `<i class="${b && i < b.strikes ? 'on' : ''}">✖</i>`).join('')}</div>${extra || ''}</div>`;
  }
  async function send(ctx, msg) {
    const r = await ctx.act(msg);
    if (r && r.ok) {
      if (r.result === 'solved') { haptic(ctx, 'success'); ctx.sfx('chime'); }
      else if (r.result === 'strike') { haptic(ctx, 'error'); ctx.sfx('zap'); }
      else haptic(ctx, 'tap');
    }
    return r;
  }
  function phoneDefuser(v, ctx) {
    const b = v.bomb, mine = b.mods.filter((m) => m.mine), others = b.mods.filter((m) => !m.mine);
    const key = v.round + ':' + (v.squad && v.squad.name);
    if (selKey !== key) { selKey = key; sel = null; armed = null; }
    const pickNext = () => (mine.find((m) => !m.solved) || mine[0] || {}).id;
    if (sel !== 'manual' && (sel == null || !mine.some((m) => m.id === sel) || (mine.find((m) => m.id === sel).solved && mine.some((m) => !m.solved)))) sel = pickNext();
    const cur = mine.find((m) => m.id === sel);
    const helpers = cur && v.help && v.help[cur.type] ? [...new Set(v.help[cur.type].map((h) => h.name))].map((name) => ({ name })) : [];
    const radio = v.radio ? `<div class="bs-radio" id="bs-radio-${v.radio.n}"><div class="rh">📻 RADIO CHECK · ${clock('radio' + key + v.radio.n, v.radio.endsIn, true)}</div><div class="cs">Callsign: <b>${esc(v.radio.call)}</b></div>
        <div class="ch">${[1, 2, 3, 4, 5, 6].map((c) => `<button data-ch="${c}">${c}</button>`).join('')}</div>${v.help && v.help.radio ? `<small>Ask: ${[...new Set(v.help.radio.map((h) => h.name))].map(esc).join(', ')}</small>` : ''}</div>` : '';
    const tabs = `<div class="bs-tabs mods">${mine.map((m) => `<button class="${m.id === sel ? 'on' : ''} ${m.solved ? 'done' : ''}" data-sel="${m.id}">${esc(m.icon)}<small>${m.solved ? '✔' : ''}</small></button>`).join('')}${v.manual ? `<button class="${sel === 'manual' ? 'on' : ''} man" data-sel="manual">📖<small>manual</small></button>` : ''}</div>`;
    let body;
    if (sel === 'manual' && v.manual) body = `<div class="bs-solo">Your experts are bots, so you get the manual too!</div>${pagesUi(v.manual.map((x) => ({ ...x, with: [] })), 'solo' + key)}`;
    else if (cur) body = `<div class="bs-mhead"><b>${esc(cur.icon)} ${esc(cur.name)}</b>${cur.solved ? '' : v.manual ? '<small>Rules: the <b>📖 manual</b> tab</small>' : helpers.length ? `<small>Ask ${helpers.map((h) => `<b>${esc(h.name)}</b>`).join(' & ')}</small>` : ''}</div>${modUi(cur)}`;
    else body = '<div class="bs-safe"><b>Nothing to defuse here.</b></div>';
    return `${head(v)}${radio}${plateHtml(v.plate)}${tabs}<div class="bs-work">${body}</div>${others.length ? `<p class="bs-others">Also on this bomb: ${others.map((m) => `${esc(m.icon)} ${m.solved ? '✔' : ''} <small>(${esc(m.owner)})</small>`).join(' · ')}</p>` : ''}`;
  }
  function bindDefuser(el, v, ctx) {
    const b = v.bomb;
    for (const t of el.querySelectorAll('[data-sel]')) t.onclick = () => { sel = t.dataset.sel === 'manual' ? 'manual' : Number(t.dataset.sel); armed = null; haptic(ctx, 'select'); ctx.redraw(); };
    for (const t of el.querySelectorAll('[data-pg]')) t.onclick = () => { pg = Number(t.dataset.pg); haptic(ctx, 'select'); ctx.redraw(); };
    for (const c of el.querySelectorAll('[data-ch]')) c.onclick = () => send(ctx, { op: 'radio', ch: Number(c.dataset.ch) });
    const cur = b.mods.find((m) => m.mine && m.id === sel); if (!cur || cur.solved) return;
    const mod = cur.id;
    for (const w of el.querySelectorAll('[data-wire]')) w.onclick = () => { armed = { mod, wire: Number(w.dataset.wire) }; haptic(ctx, 'select'); ctx.redraw(); };
    const go = el.querySelector('#bs-cutgo'); if (go) go.onclick = async () => { const a = armed; armed = null; if (a) await send(ctx, { op: 'cut', mod, wire: a.wire }); ctx.redraw(); };
    for (const k of el.querySelectorAll('[data-key]')) k.onclick = () => send(ctx, { op: 'glyph', mod, key: Number(k.dataset.key) });
    for (const d of el.querySelectorAll('[data-dir]')) d.onclick = () => send(ctx, { op: 'move', mod, dir: d.dataset.dir });
    for (const s of el.querySelectorAll('[data-shape]')) s.onclick = () => send(ctx, { op: 'lamp', mod, shape: s.dataset.shape });
    for (const d of el.querySelectorAll('[data-dig]')) d.onclick = () => { if (dial.length < 3) { dial.push(Number(d.dataset.dig)); haptic(ctx, 'tap'); ctx.redraw(); } };
    const clr = el.querySelector('#bs-dclr'); if (clr) clr.onclick = () => { dial = []; ctx.redraw(); };
    const dg = el.querySelector('#bs-dgo'); if (dg) dg.onclick = async () => { const code = dial.slice(); dial = []; if (code.length === 3) await send(ctx, { op: 'dial', mod, code }); ctx.redraw(); };
    const pl = el.querySelector('#bs-plunger');
    if (pl) {
      pl.oncontextmenu = (e) => e.preventDefault();
      pl.onpointerdown = (e) => { e.preventDefault(); try { pl.setPointerCapture(e.pointerId); } catch { /* fine */ } hold = { mod, t0: Date.now(), ctx }; haptic(ctx, 'select'); };
      const up = async () => { if (!hold) return; const dt = Date.now() - hold.t0, n = gaugeAt(dt); hold = null; pl.classList.remove('held'); await send(ctx, n ? { op: 'plunger', mod, how: 'hold', at: n } : { op: 'plunger', mod, how: 'tap' }); ctx.redraw(); };
      pl.onpointerup = up; pl.onpointercancel = up;
    }
  }

  const lobbyLines = {
    bombs: { lab: 'Bombs on the truck', opts: { 3: '3 · ~10 min', 4: '4 · ~13 min', 5: '5 · ~17 min' } },
    fuse: { lab: 'Fuse length', opts: { long: '🐢 Long', normal: '⏱ Normal', short: '🔥 Short' } },
    squads: { lab: 'Squads', opts: { auto: '🧩 Auto-split', one: '🫂 One big squad' } },
    showIntro: { lab: 'Opening briefing', opts: { true: '🎬 On', false: '⏩ Skip' } },
  };
  function lobbyTv(el, L) {
    el.__L = L;
    if (!el.__bsl) {
      el.__bsl = true;
      el.innerHTML = `<div class="bsl">
        <header class="bsl-top"><div class="bsl-tape"></div><h1 class="bsl-logo"><span>BOMB</span><span>SQUAD</span></h1><div class="bsl-sub">DISPOSAL UNIT · NOW RECRUITING</div><div class="bsl-mini">${bombArt({ status: 'defused', endsIn: 0, left: 30000, secs: 30, strikes: 0, mods: [] }, 'lobby', 'tiny')}</div></header>
        <section class="bsl-dossier"><div class="bsl-clip"></div><div class="bsl-dh">MISSION DOSSIER <small>tap to change</small></div><div id="bsl-lines"></div><div id="settings" class="bsl-sr"></div>
          <div class="bsl-rules"><b>How it works</b> · One defuser sees the bomb. Everyone else holds pages of the manual. Talk it out before the clock hits 0:00.</div></section>
        <aside class="bsl-badge"><div class="bsl-bh">SQUAD ID · SCAN TO JOIN</div><img id="qr" alt="QR code to join"><div class="bsl-url" id="bsl-url"></div><div class="bsl-codecap">ROOM CODE</div><div class="bsl-code" id="code"></div>
          <div class="bsl-vip" id="bsl-vip"></div><div class="err" id="lobby-err"></div><button class="bsl-start" id="start">💣 Bring in the first bomb</button>
          <div class="bsl-links"><button id="add-bots">+ 5 test bots</button><button id="rm-bots">remove bots</button><button id="bsl-pick">🎮 Other game</button></div></aside>
        <section class="bsl-bench"><div class="bsl-count" id="bsl-count"></div><div class="bsl-roster" id="roster"></div></section>
        <div class="bsl-party" id="bsl-party"></div></div>`;
      const $ = (s) => el.querySelector(s);
      $('#start').onclick = async () => { const r = await el.__L.start(); $('#lobby-err').textContent = r && r.ok ? '' : (r && r.error) || ''; };
      $('#add-bots').onclick = () => el.__L.bots(5);
      $('#rm-bots').onclick = () => el.__L.removeBots();
      $('#bsl-pick').onclick = () => el.__L.pick();
      el.addEventListener('click', (e) => {
        const k = e.target.closest('[data-k]');
        if (k) { for (const b of k.parentNode.querySelectorAll('.bsl-opt')) b.classList.toggle('on', b === k); const s = el.querySelector(`select[data-set="${k.dataset.k}"]`); if (s) s.value = k.dataset.v; el.__L.set(k.dataset.k, k.dataset.v); BOX.sfx('click'); return; }
        const c = e.target.closest('[data-kick]'); if (c && confirm('Remove this player?')) el.__L.kick(c.dataset.kick);
      });
    }
    const $ = (s) => el.querySelector(s);
    if ($('#code').textContent !== L.code) $('#code').textContent = L.code;
    if ($('#qr').dataset.u !== L.joinUrl) { $('#qr').src = L.qr; $('#qr').dataset.u = L.joinUrl; }
    $('#bsl-url').textContent = String(L.joinUrl || '').replace(/^https?:\/\//, '');
    const n = L.players.length;
    $('#start').disabled = n < L.min;
    const sq = L.settings.squads === 'one' || n <= 6 ? 1 : Math.min(4, Math.ceil(n / 5));
    $('#bsl-vip').innerHTML = L.vip ? `👑 <b>${esc(L.vip)}</b> can start from their phone` : n < L.min ? `${L.min - n} more recruit${L.min - n === 1 ? '' : 's'} needed…` : 'The first to join hosts 👑';
    BOX.morph($('#bsl-count'), `<b>${n}</b> RECRUIT${n === 1 ? '' : 'S'}${n >= 2 ? ` · ${sq > 1 ? `${sq} squads, ${sq} bombs at once` : 'one squad'}` : ''}`);
    const html = L.fields.map((f, i) => {
      const P = lobbyLines[f.key] || { lab: f.label, opts: {} }, cur = String(L.settings[f.key]);
      return `<div class="bsl-line"><span class="bsl-num">${String(i + 1).padStart(2, '0')}</span><div class="bsl-lab">${esc(P.lab)}</div><div class="bsl-opts">${f.options.map((o) => `<button class="bsl-opt ${String(o.value) === cur ? 'on' : ''}" data-k="${esc(f.key)}" data-v="${esc(String(o.value))}" title="${esc(o.label)}">${esc(P.opts[String(o.value)] || o.label)}</button>`).join('')}</div></div>`;
    }).join('');
    const lines = $('#bsl-lines'); if (lines.__h !== html) { lines.__h = html; BOX.morph(lines, html); }
    const box = $('#settings'), sig = L.fields.map((f) => f.key + ':' + f.options.map((o) => o.value).join('|')).join(';');
    if (box.__sig !== sig) { box.__sig = sig; box.innerHTML = L.fields.map((f) => `<label>${esc(f.label)}<select data-set="${esc(f.key)}">${f.options.map((o) => `<option value="${esc(String(o.value))}">${esc(o.label)}</option>`).join('')}</select></label>`).join(''); }
    for (const s of box.querySelectorAll('select[data-set]')) { if (document.activeElement !== s) s.value = String(L.settings[s.dataset.set]); s.onchange = () => { s.blur(); el.__L.set(s.dataset.set, s.value); }; }
    const r = $('#roster'); r.classList.toggle('many', n > 12);
    const rh = n ? L.players.map((p, i) => `<span class="chip ${p.online ? '' : 'off'}" data-kick="${esc(p.id)}" title="Click to remove" style="--c:${esc(p.color || '#ffd23f')};--d:${((i * 0.37) % 2.2).toFixed(2)}s"><span class="hat">⛑️</span><span class="f">${esc(p.avatar || '🙂')}</span><b>${esc(p.name)}</b></span>`).join('') : '<div class="bsl-empty">The bench is empty. Scan the badge to join the squad!</div>';
    if (r.__h !== rh) { r.__h = rh; BOX.morph(r, rh); }
    const lp = $('#bsl-party'), lh = L.lineupHtml || ''; if (lp.__h !== lh) { lp.__h = lh; lp.innerHTML = lh; }
  }

  BOX.games.bomb = {
    name: 'Bomb Squad', icon: '💣', lobbyTv,
    about: 'One of you sees the bomb. Everyone else holds a different page of the manual. Talk fast, cut carefully.',
    how: [
      'Each round a bomb arrives. Only the DEFUSER can see it, on their phone.',
      'Everyone else gets different pages of the defusal manual. Each module’s rules are split between two experts, so talk out loud!',
      'Solve every module (Fuse Lines, the Plunger, the Glyph Pad, the Tunnel Map, the Combination Dial, Signal Lamps) to defuse it.',
      'A wrong move is a strike and burns 15 seconds. Three strikes or 0:00 and it goes KA-BLAM.',
      'Bombs get harder, and from bomb 3 the Radio keeps asking for a callsign. Big groups split into squads with a bomb each.',
      'The team shares a score; you earn points for solving modules (+150), holding the right page (+100) and every defused bomb (+200).',
    ],
    music: (s) => ({ brief: 'play', tick: 'think', reveal: 'reveal', over: 'finale' }[s.phase] || 'play'),
    fx: { round: 'whoosh', arm: 'click', strike: 'zap', solve: 'chime', radio: 'siren', boom: 'explosion', defused: 'win', cheer: 'cheer', groan: 'groan', win: 'win' },

    tv(el, s) {
      if (!s) return;
      isTV = true;
      if (s.phase === 'over') { paint(el, tvOver(s), 'over'); return; }
      const top = `<div class="bs-top"><span class="bs-tag">💣 BOMB SQUAD</span><span>Bomb <b>${s.round}</b> of ${s.of}</span><span>🧩 ${s.mods} modules${s.needy ? ' + 📻' : ''}</span><span class="bs-teamtop">Team <b>${s.team}</b></span></div>`;
      const main = s.phase === 'brief' ? tvBrief(s) : s.phase === 'tick' ? tvTick(s) : s.phase === 'reveal' ? tvReveal(s) : '';
      paint(el, `<div class="bs-tv ph-${s.phase}">${top}${main}</div>`, s.phase + '-' + s.round);
    },

    phone(el, v, ctx) {
      // JustGold gear: this game's phone theme, a frame and badge over your screen (public/shared/gear.js).
      if (window.MT_GEAR) window.MT_GEAR.phoneTheme(el, arguments[3], 'bomb');
      if (!v) return;
      if (v.phase === 'over') {
        feel(ctx, 'over', 1, v.rank === 1 ? 'win' : 'success');
        const f = v.final || {};
        paint(el, `<div class="bs-pover"><div class="bs-medal">${v.rank === 1 ? '🏆' : v.rank === 2 ? '🥈' : v.rank === 3 ? '🥉' : '🎖️'}</div>
          <h3>#${v.rank} of ${v.players} · ${v.points} pts</h3>
          <div class="bs-mystats"><span>🧤 <b>${v.stats.solves}</b> modules</span><span>📖 <b>${v.stats.assists}</b> assists</span><span>✖ <b>${v.stats.strikes}</b> strikes</span></div>
          <div class="bs-team2">Team score <b>${f.team || 0}</b> · ${f.defused || 0}/${f.played || 0} bombs defused</div></div>
          ${awardsHtml(f.awards)}<div class="card-box">${BOX.board(v.standings || [], (r) => r.points, ' pts')}</div>`, 'over');
        return;
      }
      if (felt.over) felt = {};
      if (v.role === 'none' || !v.bomb) { paint(el, `<div class="bs-wait"><div class="bs-wbomb">💣</div><b>Watch the big screen!</b><p>You’ll join a squad on the next bomb.</p></div>`, 'none-' + v.round); return; }
      const b = v.bomb;
      if (v.phase === 'brief') {
        feel(ctx, 'brief', v.round, v.role === 'defuser' ? 'turn' : 'select');
        const html = v.role === 'defuser'
          ? `<div class="bs-role def"><div class="bs-hat2">⛑️</div><h2>You’re the DEFUSER</h2><p>Only <b>you</b> can see bomb ${v.round}. Describe everything out loud. Your experts have the manual.</p>
              <div class="bs-who">${(v.help && Object.values(v.help).flat().length) ? `Your experts: <b>${[...new Set(Object.values(v.help).flat().map((h) => h.name))].map(esc).join(', ')}</b>` : 'No human experts: you’ll get the manual too.'}</div><div class="bs-arming">Arming in ${BOX.timer(v.endsIn)}</div></div>`
          : `<div class="bs-role exp"><div class="bs-hat2">📖</div><h2>You’re an EXPERT</h2><p>You can’t see the bomb. You hold ${plural((v.pages || []).length, 'page')} of the manual. Ask <b>${v.defusers.map((d) => esc(d.name)).join(' & ')}</b> what they see!</p>
              <div class="bs-chips">${(v.pages || []).map((x) => `<span>${esc(x.icon)} ${esc(x.name)} <small>part ${x.part === 'A' ? 1 : 2}</small></span>`).join('')}</div><div class="bs-arming">Arming in ${BOX.timer(v.endsIn)}</div></div>`;
        paint(el, `${head(v)}${html}`, 'brief-' + v.round);
        return;
      }
      if (v.phase === 'reveal') {
        const ok = b.status === 'defused';
        feel(ctx, 'rev', v.round, ok ? 'win' : 'big');
        paint(el, `<div class="bs-pres ${ok ? 'ok' : 'boom'}"><div class="bs-pbig">${ok ? '✔' : '💥'}</div><h2>${ok ? 'DEFUSED!' : 'KA-BLAM!'}</h2>
          <p>${ok ? `With ${fmt(b.left)} to spare.` : b.why === 'strikes' ? 'Three strikes.' : 'Out of time.'}</p><div class="bs-gain">+${v.gained} pts this bomb</div><p class="muted">${v.points} pts · #${v.rank} of ${v.players}</p></div>`, 'rev-' + v.round);
        return;
      }
      // tick
      feel(ctx, 'strikes', v.round + ':' + b.strikes, b.strikes ? 'buzz' : 'tap');
      if (v.radio) feel(ctx, 'radio', v.round + ':' + v.radio.n, 'warn');
      if (b.status !== 'live') {
        paint(el, `${head(v)}<div class="bs-pres ${b.status === 'defused' ? 'ok' : 'boom'}"><div class="bs-pbig">${b.status === 'defused' ? '✔' : '💥'}</div><h2>${b.status === 'defused' ? 'DEFUSED!' : 'KA-BLAM!'}</h2><p>Waiting for the other squads… watch the big screen!</p></div>`, 'done-' + v.round);
        return;
      }
      if (v.role === 'defuser') {
        paint(el, phoneDefuser(v, ctx), 'def-' + v.round);
        bindDefuser(el, v, ctx);
        return;
      }
      const pages = v.pages || [];
      const radioNote = b.radio ? `<div class="bs-rnote">📻 The radio wants a callsign! ${pages.some((x) => x.type === 'radio') ? 'You have the Radio page: help them!' : ''}</div>` : '';
      paint(el, `${head(v)}${radioNote}<div class="bs-ask">Ask <b>${v.defusers.map((d) => `${av(d)} ${esc(d.name)}`).join(' & ')}</b> what they see on the bomb.</div>
        <div class="bs-modstat">${b.mods.map((m) => `<span class="${m.solved ? 'ok' : ''}">${esc(m.icon)}${m.solved ? '✔' : ''}</span>`).join('')}</div>${pagesUi(pages, 'x' + v.round)}`, 'exp-' + v.round);
      for (const t of el.querySelectorAll('[data-pg]')) t.onclick = () => { pg = Number(t.dataset.pg); haptic(ctx, 'select'); ctx.redraw(); };
    },
  };
})();
