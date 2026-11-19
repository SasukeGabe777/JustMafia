'use strict';
// JustEscape: TV and phone screens. A noir case file: Detective Hazel Finch (drawn with the
// intro's own character, BOX.intros.escape.host) briefs the room, speaks her lines and gives
// hints; the TV is the case board (locks, who holds what, the line-up); each phone holds its own
// evidence or the controls of a lock.
(function () {
  const { esc, timer } = BOX;
  const av = (r) => esc((r && r.avatar) || '🙂');
  const COAT = { red: '#c0392b', green: '#2e8b57', blue: '#2f5fb3', yellow: '#e1b12c', grey: '#8a8f98' };
  // JustGold gear: a detective's magnifier (rim colour a, handle b, glow). '' for the default
  // brass lens, so nothing changes for players without gear.
  function lens(gear, size = 26) {
    const pt = window.MT_GEAR ? MT_GEAR.paint('escape', 'magnifier', gear) : null;
    if (!pt) return '';
    const a = esc(pt.a || '#c9a14a'), b = esc(pt.b || '#5a3a1a');
    return `<svg class="es-lens" width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true" style="vertical-align:middle${pt.glow ? `;filter:drop-shadow(0 0 4px ${a})` : ''}"><path d="M25 25 L36 36" stroke="#1a1a1a" stroke-width="8" stroke-linecap="round"/><path d="M25 25 L36 36" stroke="${b}" stroke-width="5" stroke-linecap="round"/><circle cx="16" cy="16" r="12" fill="rgba(200,235,255,.55)" stroke="#1a1a1a" stroke-width="6"/><circle cx="16" cy="16" r="12" fill="none" stroke="${a}" stroke-width="3.5"/><path d="M10 12 Q12 8 16 8" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>`;
  }
  const PART_ICON = { legend: '📒', engraving: '🔣', keypad: '🔢', photo: '📷', note: '📝', dial: '🕰️', pattern: '🎼', key: '🗝️', panel: '🎚️', tag: '🏷️', letters: '🔤', map: '🗺️', lantern: '🕯️' };

  // ---------------- shared drawings ----------------
  // A suspect: coat colour, hat, and what they carry (SVG, so the TV and phones match).
  function suspectSvg(s, size = 90) {
    const coat = COAT[s.coat] || '#888', dark = '#1b1424';
    const hat = /top hat/.test(s.hat) ? `<rect x="33" y="6" width="34" height="26" rx="3" fill="${dark}"/><rect x="24" y="29" width="52" height="6" rx="3" fill="${dark}"/><rect x="33" y="24" width="34" height="5" fill="#8b1a1a"/>`
      : /beret/.test(s.hat) ? `<ellipse cx="52" cy="27" rx="25" ry="10" fill="#7a2e8e" stroke="${dark}" stroke-width="3"/><circle cx="55" cy="16" r="3" fill="#7a2e8e"/>`
        : /flat cap/.test(s.hat) ? `<path d="M27 32 Q50 8 73 30 Z" fill="#6b5a3e" stroke="${dark}" stroke-width="3"/><path d="M58 30 Q76 30 82 34 Q70 37 58 34Z" fill="#6b5a3e" stroke="${dark}" stroke-width="3"/>`
          : `<path d="M30 36 Q32 16 50 16 Q68 16 70 36 Q62 26 50 27 Q38 26 30 36Z" fill="#3b2a1e"/>`;
    const item = /cane/.test(s.item) ? `<path d="M84 136 L84 82 Q84 74 76 74" fill="none" stroke="#5a3a1a" stroke-width="5" stroke-linecap="round"/>`
      : /umbrella/.test(s.item) ? `<path d="M70 90 Q86 70 102 90 Z" fill="#2a2a3a" stroke="${dark}" stroke-width="2"/><line x1="86" y1="88" x2="86" y2="136" stroke="${dark}" stroke-width="3"/>`
        : /pipe/.test(s.item) ? `<path d="M56 54 L70 56 L72 64 Q66 70 62 62 L56 58Z" fill="#5a3a1a" stroke="${dark}" stroke-width="2"/><path d="M70 50 Q74 44 70 38" stroke="#ccc" fill="none" stroke-width="2" opacity=".8"/>`
          : /book/.test(s.item) ? `<rect x="72" y="92" width="20" height="26" rx="2" fill="#7a1f2b" stroke="${dark}" stroke-width="2.5"/><line x1="76" y1="96" x2="76" y2="114" stroke="#e8d5a0" stroke-width="2"/>`
            : `<rect x="76" y="96" width="16" height="20" rx="3" fill="#f5c542" stroke="${dark}" stroke-width="2.5"/><path d="M78 96 Q84 86 90 96" fill="none" stroke="${dark}" stroke-width="2.5"/><circle cx="84" cy="106" r="4" fill="#fff5c0"/>`;
    return `<svg viewBox="0 0 110 150" width="${size}" height="${Math.round(size * 1.36)}" aria-hidden="true"><ellipse cx="52" cy="144" rx="34" ry="5" fill="rgba(0,0,0,.35)"/>
      <path d="M22 140 L28 74 Q50 62 76 74 L82 140 Z" fill="${coat}" stroke="${dark}" stroke-width="3.5" stroke-linejoin="round"/><path d="M50 72 L50 140" stroke="rgba(0,0,0,.25)" stroke-width="3"/>
      <circle cx="50" cy="48" r="20" fill="#e8b98f" stroke="${dark}" stroke-width="3.5"/><circle cx="43" cy="47" r="2.4" fill="${dark}"/><circle cx="57" cy="47" r="2.4" fill="${dark}"/><path d="M44 57 Q50 60 56 57" stroke="${dark}" stroke-width="2" fill="none"/>
      ${hat}${item}</svg>`;
  }
  // An analog clock face.
  function clockSvg(h, m, size = 150, label = '') {
    const ha = ((h % 12) + m / 60) * 30, ma = m * 6, P = (a, r) => [70 + Math.sin((a * Math.PI) / 180) * r, 70 - Math.cos((a * Math.PI) / 180) * r];
    const ticks = Array.from({ length: 12 }, (_, i) => { const [x1, y1] = P(i * 30, 56), [x2, y2] = P(i * 30, i % 3 ? 51 : 46); return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#2a1d10" stroke-width="${i % 3 ? 2 : 4}"/>`; }).join('');
    const nums = [12, 3, 6, 9].map((n, i) => { const [x, y] = P(i * 90, 37); return `<text x="${x}" y="${y + 6}" text-anchor="middle" font-size="16" font-family="Georgia,serif" fill="#2a1d10">${n}</text>`; }).join('');
    const [hx, hy] = P(ha, 30), [mx, my] = P(ma, 48);
    return `<svg viewBox="0 0 140 140" width="${size}" height="${size}" aria-label="${esc(label)}"><circle cx="70" cy="70" r="64" fill="#f6ecd2" stroke="#5a3a1a" stroke-width="8"/>${ticks}${nums}
      <line x1="70" y1="70" x2="${hx}" y2="${hy}" stroke="#1b1424" stroke-width="7" stroke-linecap="round"/><line x1="70" y1="70" x2="${mx}" y2="${my}" stroke="#1b1424" stroke-width="4" stroke-linecap="round"/><circle cx="70" cy="70" r="6" fill="#c8102e"/></svg>`;
  }
  function mazeSvg(d, size = 240, live = true) {
    const n = d.n, c = 100 / n;
    const cells = (d.walls || []).map((w, i) => (w ? `<rect x="${(i % n) * c}" y="${Math.floor(i / n) * c}" width="${c}" height="${c}" fill="#2b2118"/>` : '')).join('');
    const at = (i, fill, r) => `<circle cx="${((i % n) + 0.5) * c}" cy="${(Math.floor(i / n) + 0.5) * c}" r="${c * r}" fill="${fill}"/>`;
    const trail = (d.trail || []).map((i) => at(i, 'rgba(232,180,74,.25)', 0.18)).join('');
    return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" class="es-maze"><rect width="100" height="100" fill="#e9dcbc"/>${cells}
      <g stroke="rgba(90,58,26,.25)" stroke-width=".4">${Array.from({ length: n + 1 }, (_, i) => `<line x1="${i * c}" y1="0" x2="${i * c}" y2="100"/><line x1="0" y1="${i * c}" x2="100" y2="${i * c}"/>`).join('')}</g>
      ${trail}${d.start != null ? at(d.start, '#2fb35a', 0.28) : ''}${d.exit != null ? `<text x="${((d.exit % n) + 0.5) * c}" y="${(Math.floor(d.exit / n) + 0.75) * c}" font-size="${c * 0.7}" text-anchor="middle">🚪</text>` : ''}
      ${live && d.pos != null ? at(d.pos, '#e8b44a', 0.36) + at(d.pos, '#fff5c0', 0.18) : ''}</svg>`;
  }

  // ---------------- phone ----------------
  const PH = { input: {}, lastPhase: '', fb: {}, seenSolved: new Set(), lastAccuse: false };
  const inp = (id, init) => { if (!(id in PH.input)) PH.input[id] = init; return PH.input[id]; };
  function teamLine(c) {
    if (!c.team.length) return '';
    return `<div class="es-team">${c.team.map((t) => `<span>${av(t)} <b>${esc(t.name)}</b>${lens(t.gear, 18)} ${t.role === 'hands' ? 'has the controls' : `has ${esc(t.label || 'evidence')}`}</span>`).join('')}</div>`;
  }
  function evidenceHtml(part, d) {
    switch (part) {
      case 'legend': return `<div class="es-legend">${d.pairs.map(([s, n]) => `<div><span class="es-sym">${esc(s)}</span><b>${n}</b></div>`).join('')}</div><p class="es-say">Read out each symbol and its number.</p>`;
      case 'engraving': return `<div class="es-engr">${d.seq.map((s) => `<span class="es-sym big">${esc(s)}</span>`).join('')}</div><p class="es-say">Read the symbols out, left to right.</p>`;
      case 'photo': return `<div class="es-photo" data-time="${d.h}:${d.m}">${clockSvg(d.h, d.m, 170, 'the clock in the photo')}</div><p class="es-say">Describe exactly where the hands point.</p>`;
      case 'note': return `<div class="es-note">${esc(d.text)}</div>`;
      case 'pattern': return `<div class="es-pattern">${d.rows.map((r) => `<div>${r.sym ? `<span class="es-sym">${esc(r.sym)}</span>` : `<i style="background:${esc(r.hex)}"></i><span>${esc(r.name)}</span>`}<b>${r.up ? '⬆ UP' : '⬇ DOWN'}</b></div>`).join('')}</div>`;
      case 'key': return `<div class="es-pattern">${d.rows.map((r) => `<div><span class="es-sym">${esc(r.sym)}</span><span>means</span><i style="background:${esc(r.hex)}"></i><b>${esc(r.name)}</b></div>`).join('')}</div>`;
      case 'tag': return `<div class="es-tag">${Array.from({ length: d.len }, (_, i) => { const l = d.letters.find((x) => x.pos === i + 1); return `<span class="${l ? 'on' : ''}"><small>${i + 1}</small>${l ? esc(l.ch) : ''}</span>`; }).join('')}</div><p class="es-say">Say which letters you have, and which spots they go in.</p>`;
      case 'map': return `<div class="es-mapwrap">${mazeSvg(d, 250)}</div><p class="es-say">🟢 start · 🚪 exit · the gold light is the lantern. Guide them: up, down, left, right.</p>`;
      default: return '';
    }
  }
  function controlsHtml(c) {
    const id = c.lock, d = c.data;
    if (c.part === 'keypad') {
      const v = inp(id, '');
      return `<div class="es-display">${Array.from({ length: d.len }, (_, i) => `<span>${esc(v[i] || '')}</span>`).join('')}</div>
        <div class="es-keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '⌫', 0, '✓'].map((k) => `<button class="es-key ${k === '✓' ? 'go' : ''}" data-k="${k}">${k}</button>`).join('')}</div>`;
    }
    if (c.part === 'dial') {
      const v = inp(id, { h: 12, m: 0 });
      return `<div class="es-dial">${clockSvg(v.h, v.m, 150, 'your clock')}<div class="es-set"><div><button data-dh="-1">◀</button><b>${v.h}</b><button data-dh="1">▶</button><small>hour</small></div>
        <div><button data-dm="-5">◀</button><b>${String(v.m).padStart(2, '0')}</b><button data-dm="5">▶</button><small>minutes</small></div></div></div><button class="es-go" data-submit>🕰️ Set the clock</button>`;
    }
    if (c.part === 'panel') {
      const v = inp(id, d.switches.map(() => 0));
      return `<div class="es-panel">${d.switches.map((s, i) => `<button class="es-sw ${v[i] ? 'up' : ''}" data-sw="${i}" style="--c:${esc(s.hex)}"><small>${s.n}</small><i></i><span>${esc(s.name)}</span><b>${v[i] ? 'UP' : 'DOWN'}</b></button>`).join('')}</div><button class="es-go" data-submit>🎚️ Pull the big lever</button>`;
    }
    if (c.part === 'letters') {
      return `<div class="es-wordin" data-keep id="es-w-${id}"><input maxlength="${d.len}" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="${'•'.repeat(d.len)}" enterkeyhint="go"></div><button class="es-go" data-submit>🔤 Try the word</button>`;
    }
    if (c.part === 'lantern') {
      const bumped = d.bumpAt && Date.now() - (PH.fb['bump' + id] || 0) < 1500;
      return `<div class="es-dark ${bumped ? 'bump' : ''}"><div class="es-glow"></div><p>It’s pitch dark. Listen to whoever has the map.</p><small>${d.steps} steps · ${d.bumps} bumps${d.atStart ? ' · at the start' : ''}</small></div>
        <div class="es-pad"><button data-mv="up">⬆</button><button data-mv="left">⬅</button><button data-mv="down">⬇</button><button data-mv="right">➡</button></div>`;
    }
    return '';
  }
  function cardHtml(c, v) {
    const head = `<div class="es-ch"><span class="es-ci">${esc(c.icon)}</span>${lens(v.gear, 40)}<div><b>${esc(c.name)}</b><small>${c.role === 'hands' ? `You have the controls: <b>${esc(c.label)}</b>` : `You have: <b>${PART_ICON[c.part] || ''} ${esc(c.label)}</b>${c.copy ? ' (a copy)' : ''}`}</small></div></div>`;
    if (c.solved) return `<section class="es-card solved">${head}<div class="es-open">🔓 Open!${c.by ? ` <small>by ${esc(c.by)}</small>` : ''}</div></section>`;
    const body = c.role === 'hands' ? controlsHtml(c) : evidenceHtml(c.part, c.data);
    const shared = c.shared.length ? `<div class="es-shared">${c.shared.map((sh) => `<div class="es-sh"><div class="es-shh">🤖 ${esc(sh.from.name)} reads out <b>${esc(sh.label)}</b>:</div>${evidenceHtml(sh.part, sh.data)}</div>`).join('')}</div>` : '';
    const hints = c.hints.length ? `<div class="es-hints">${c.hints.map((h) => `<p>💡 ${esc(h)}</p>`).join('')}</div>` : '';
    const hintBtn = v.hintsOn && c.hintsLeft > 0 ? `<button class="link es-hintbtn" data-hint="${c.lock}">💡 Ask Hazel for a hint <small>(costs the team)</small></button>` : '';
    const fb = PH.fb[c.lock] ? `<div class="es-fb ${esc(PH.fb[c.lock].k)}">${esc(PH.fb[c.lock].t)}</div>` : '';
    return `<section class="es-card ${c.role}" data-lock="${c.lock}">${head}${teamLine(c)}${body}${fb}${shared}${hints}${hintBtn}</section>`;
  }
  function accuseHtml(A, v) {
    const clues = A.clues.length ? `<div class="es-clues"><b>🗂️ Your clues</b>${A.clues.map((t) => `<p>“${esc(t)}”</p>`).join('')}</div>` : '';
    if (!A.open) return clues ? `<section class="es-card es-later">${clues}<small class="muted">Keep these for the end: when every lock is open, everyone reads out their clues and votes on who did it.</small></section>` : '';
    return `<section class="es-card es-accuse"><div class="es-ch"><span class="es-ci">🔎</span><div><b>Who did it?</b><small>Read your clues out loud. Everyone votes · ${A.votes} of ${A.of} voted</small></div></div>${clues}
      <div class="es-lineup">${A.suspects.map((s) => `<button class="es-sus ${A.vote === s.id ? 'on' : ''} ${A.wrong.includes(s.id) ? 'out' : ''}" data-vote="${s.id}" ${A.wrong.includes(s.id) ? 'disabled' : ''}>${suspectSvg(s, 64)}<b>${esc(s.name)}</b><small>${esc(s.job)}</small><em>${esc(s.hat)} · ${esc(s.coat)} coat · ${esc(s.item)}</em></button>`).join('')}</div>
      ${A.hints.length ? `<div class="es-hints">${A.hints.map((h) => `<p>💡 ${esc(h)}</p>`).join('')}</div>` : ''}${v.hintsOn && A.hintsLeft > 0 ? `<button class="link es-hintbtn" data-hint="${A.id}">💡 Ask Hazel for a hint</button>` : ''}</section>`;
  }
  const stars = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
  function phone(el, v, ctx) {
    if (!v) return;
    const key = v.phase + (v.room ? v.room.i : '');
    if (key !== PH.lastPhase) {
      PH.lastPhase = key; PH.fb = {};
      if (v.phase === 'play') ctx.haptic('turn');
      if (v.phase === 'outro') ctx.haptic(v.outro && v.outro.cleared ? 'win' : 'warn');
      if (v.phase === 'over') ctx.haptic(v.rank === 1 ? 'win' : 'success');
    }
    const top = v.room ? `<div class="es-bar"><span>${esc(v.room.icon)} ${esc(v.room.name)} <small>${esc(v.room.diff)}</small></span><span>${v.phase === 'play' ? '⏱ ' + timer(v.endsIn) : ''}</span><b>${v.points}</b></div>` : '';
    if (v.phase === 'over') {
      return BOX.morph(el, `<div class="es-ph"><section class="es-card es-end"><div class="es-stamp">CASE CLOSED</div><h2>${v.rank === 1 ? '🏆 Top detective!' : `#${v.rank} of ${v.of}`}</h2><p>${v.points} points</p>
        <div class="es-hist">${v.history.map((h) => `<div>${esc(h.icon)} ${esc(h.name)} <b>${h.cleared ? stars(h.stars) : 'Hazel finished it'}</b></div>`).join('')}</div>
        <div class="es-stats"><span>🔓 ${v.stats.locks} locks</span><span>🔎 ${v.stats.caught} culprits</span><span>✖ ${v.stats.wrong} wrong tries</span></div></section></div>`);
    }
    if (v.phase === 'story') {
      BOX.morph(el, `<div class="es-ph">${top}<section class="es-card es-brief"><div class="es-hz">🕵️‍♀️ <b>Detective Hazel Finch</b></div><p class="es-story">${esc(v.story || '')}</p>
        <button class="es-go" id="es-ready" ${v.ready ? 'disabled' : ''}>${v.ready ? '✅ Ready, waiting for the others…' : '🔍 I’m ready to investigate'}</button></section></div>`);
      const b = el.querySelector('#es-ready'); if (b) b.onclick = async () => { const r = await ctx.act({ op: 'ready' }); if (r.ok) ctx.haptic('success'); };
      return;
    }
    if (v.phase === 'outro') {
      const O = v.outro || {};
      return BOX.morph(el, `<div class="es-ph">${top}<section class="es-card es-brief"><div class="es-stamp ${O.cleared ? '' : 'red'}">${O.cleared ? 'SOLVED' : 'TIME’S UP'}</div>
        ${O.culprit ? `<div class="es-culprit">${suspectSvg(O.culprit, 70)}<div><small>The culprit</small><b>${esc(O.culprit.name)}</b><span>${esc(O.culprit.job)}</span></div></div>` : ''}
        ${O.cleared ? `<div class="es-stars">${stars(O.stars)}</div>` : ''}<p class="es-story">${esc(v.story || '')}</p></section></div>`);
    }
    // play
    for (const c of v.cards) if (c.solved && !PH.seenSolved.has(c.lock + ':' + v.room.i)) { PH.seenSolved.add(c.lock + ':' + v.room.i); ctx.haptic('success'); }
    if (v.accuse.open && !PH.lastAccuse) ctx.haptic('turn'); PH.lastAccuse = v.accuse.open;
    const open = v.cards.filter((c) => !c.solved), done = v.cards.filter((c) => c.solved);
    const progress = `<div class="es-prog">${v.locks.map((L) => `<span class="${L.solved ? 'on' : ''}" title="${esc(L.name)}">${L.solved ? '🔓' : '🔒'}</span>`).join('')}<span class="${v.accuse.open ? 'on' : ''}">🔎</span></div>`;
    const main = v.accuse.open ? accuseHtml(v.accuse, v) + done.map((c) => cardHtml(c, v)).join('')
      : (open.length ? open.map((c) => cardHtml(c, v)).join('') : `<section class="es-card es-wait"><p>🔓 Your locks are open! Help the others: listen and look over shoulders.</p></section>`) + accuseHtml(v.accuse, v) + done.map((c) => cardHtml(c, v)).join('');
    BOX.morph(el, `<div class="es-ph">${top}${progress}${main}</div>`);
    bind(el, v, ctx);
  }
  function bind(el, v, ctx) {
    const send = async (lock, value) => {
      const r = await ctx.act({ op: 'answer', lock, value });
      if (!r || !r.ok) return;
      if (r.right) { PH.fb[lock] = null; ctx.haptic('success'); ctx.sfx && ctx.sfx('chime'); }
      else { PH.fb[lock] = { k: 'no', t: '✖ Not quite. Check the evidence again.' }; ctx.haptic('error'); }
      ctx.redraw();
    };
    for (const sec of el.querySelectorAll('.es-card[data-lock]')) {
      const id = Number(sec.dataset.lock), c = v.cards.find((x) => x.lock === id && x.role === 'hands');
      for (const b of sec.querySelectorAll('[data-k]')) b.onclick = () => {
        const k = b.dataset.k, len = c.data.len; let s = inp(id, '');
        if (k === '⌫') s = s.slice(0, -1); else if (k === '✓') { if (s.length === len) { send(id, s); PH.input[id] = ''; } else ctx.toast(`Enter ${len} numbers.`); return; } else if (s.length < len) s += k;
        PH.input[id] = s; ctx.haptic('tap'); ctx.redraw();
      };
      for (const b of sec.querySelectorAll('[data-dh]')) b.onclick = () => { const s = inp(id, { h: 12, m: 0 }); s.h = ((s.h - 1 + Number(b.dataset.dh) + 12) % 12) + 1; ctx.haptic('tap'); ctx.redraw(); };
      for (const b of sec.querySelectorAll('[data-dm]')) b.onclick = () => { const s = inp(id, { h: 12, m: 0 }); s.m = (s.m + Number(b.dataset.dm) + 60) % 60; ctx.haptic('tap'); ctx.redraw(); };
      for (const b of sec.querySelectorAll('[data-sw]')) b.onclick = () => { const s = inp(id, []); const i = Number(b.dataset.sw); s[i] = s[i] ? 0 : 1; ctx.haptic('select'); ctx.redraw(); };
      for (const b of sec.querySelectorAll('[data-mv]')) b.onclick = async () => {
        const r = await ctx.act({ op: 'move', lock: id, dir: b.dataset.mv });
        if (r && r.bump) { PH.fb['bump' + id] = Date.now(); ctx.haptic('buzz'); PH.fb[id] = { k: 'no', t: r.reset ? '💥 Bump! Back to the start…' : '💥 Bump! A wall.' }; }
        else if (r && r.ok) { ctx.haptic('tap'); PH.fb[id] = null; }
        ctx.redraw();
      };
      const sub = sec.querySelector('[data-submit]');
      if (sub && c) sub.onclick = () => {
        if (c.part === 'dial') send(id, inp(id, { h: 12, m: 0 }));
        else if (c.part === 'panel') send(id, c.data.switches.map((_, i) => (inp(id, [])[i] ? 1 : 0)).join(''));
        else if (c.part === 'letters') { const w = sec.querySelector('input'); const val = (w.value || '').trim(); if (!val) return; send(id, val); w.value = ''; }
      };
      const w = sec.querySelector('.es-wordin input'); if (w) w.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); sub && sub.onclick(); } };
    }
    for (const b of el.querySelectorAll('[data-hint]')) b.onclick = async () => { const r = await ctx.act({ op: 'hint', lock: Number(b.dataset.hint) }); if (r && r.ok) ctx.haptic('select'); };
    for (const b of el.querySelectorAll('[data-vote]')) b.onclick = async () => { const r = await ctx.act({ op: 'vote', suspect: Number(b.dataset.vote) }); if (r && r.ok) { ctx.haptic('select'); ctx.redraw(); } };
  }

  // ---------------- TV ----------------
  const TV = { said: null, cv: null, raf: 0, host: null, anim: null, s: null, sayUntil: 0 };
  function hazelSpec() { const I = BOX.intros && BOX.intros.escape; return I && I.host ? I.host : null; }
  function speak(h) {
    if (!h || TV.said === h.at + h.key) return;
    TV.said = h.at + h.key;
    const H = hazelSpec(), ms = Math.max(1500, h.text.length * 62);
    TV.sayUntil = Date.now() + ms; if (TV.anim) TV.anim.talk(performance.now(), ms);
    try { if (BOX.voice && BOX.voice.speak) BOX.voice.speak(h.text, H ? H.voice : {}); } catch (e) { /* no voice */ }
  }
  // Hazel herself, drawn with the intro's character (her office light behind her).
  function hazelLoop() {
    TV.raf = requestAnimationFrame(hazelLoop);
    const cv = TV.cv; if (!cv || !cv.isConnected) return;
    const H = hazelSpec(); if (!H || !BOX.studio) return;
    if (!TV.host) { try { TV.host = BOX.studio.makeHost(H.look || {}); TV.anim = new BOX.studio.HostAnim(H); } catch (e) { return; } }
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
    const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
    const gr = g.createRadialGradient(cv.width / 2, cv.height * 0.35, 5, cv.width / 2, cv.height * 0.4, cv.width * 0.7); gr.addColorStop(0, 'rgba(232,180,74,.35)'); gr.addColorStop(1, 'rgba(232,180,74,0)'); g.fillStyle = gr; g.fillRect(0, 0, cv.width, cv.height);
    const sc = (cv.height / 520) * 1; g.translate(cv.width / 2, cv.height * 0.98); g.scale(sc, sc);
    if (Date.now() < TV.sayUntil && TV.anim.talkUntil < performance.now()) TV.anim.talk(performance.now(), TV.sayUntil - Date.now());
    try { TV.host(g, TV.anim.frame(performance.now())); } catch (e) { /* drawing */ }
  }
  function mountHazel(el) {
    const box = el.querySelector('#es-hazel'); if (!box) return;
    if (!box.querySelector('canvas')) box.innerHTML = '<canvas></canvas>';
    TV.cv = box.querySelector('canvas');
    if (BOX.studio && BOX.studio.need) BOX.studio.need('escape', () => {});
    if (!TV.raf) TV.raf = requestAnimationFrame(hazelLoop);
  }
  function lockCard(L) {
    if (L.kind === 'deduce') return '';
    const team = L.team.map((t) => `<span class="${t.role}">${av(t)} ${esc(t.name)}${lens(t.gear) ? ' ' + lens(t.gear) : ''} <small>${t.role === 'hands' ? '🎛️ ' : (PART_ICON[t.label] || '')}${esc(t.label || '')}</small></span>`).join('');
    return `<div class="es-lock ${L.solved ? 'open' : ''}"><div class="es-lh"><span class="es-li">${esc(L.icon)}</span><b>${esc(L.name)}</b><span class="es-pad">${L.solved ? '🔓' : '🔒'}</span></div>
      ${L.solved ? `<div class="es-lo">Opened${L.by ? ` by ${esc(L.by)}` : ''}!</div>` : `<div class="es-lt">${team}</div>${L.maze ? `<div class="es-lm">${mazeSvg({ n: L.maze.n, walls: [], pos: L.maze.pos, exit: L.maze.exit, trail: L.maze.trail }, 120)}</div>` : ''}${L.tries ? `<div class="es-ltries">✖ ${L.tries} wrong ${L.tries === 1 ? 'try' : 'tries'}</div>` : ''}${L.hints.length ? `<div class="es-lhint">💡 ${esc(L.hints[L.hints.length - 1])}</div>` : ''}`}</div>`;
  }
  function tvPlay(el, s) {
    const A = s.accuse, lowTime = s.endsIn < 60000;
    const board = A ? `<div class="es-line"><h2>🔎 Who did it? <small>${A.votes} of ${A.of} voted · read your clues out loud</small></h2><div class="es-sus-row">${A.suspects.map((x) => `<div class="es-tsus ${A.wrong.includes(x.id) ? 'out' : ''}">${suspectSvg(x, 120)}<b>${esc(x.name)}</b><small>${esc(x.job)}</small><em>${esc(x.hat)} · ${esc(x.coat)} coat · ${esc(x.item)}</em></div>`).join('')}</div></div>`
      : `<div class="es-locks">${s.locks.map(lockCard).join('')}</div>`;
    const side = `<aside class="es-side"><div class="es-hazel" id="es-hazel" data-keep></div><div class="es-bubble"><b>Hazel Finch</b><p>${esc(s.hazel ? s.hazel.text : '')}</p></div>
      <ul class="es-events">${(s.events || []).slice().reverse().map((e) => `<li>${esc(e.icon)} ${esc(e.t)}</li>`).join('')}</ul></aside>`;
    BOX.morph(el, `<div class="es-tv"><header class="es-top"><div class="es-room">${esc(s.room.icon)} <b>${esc(s.room.name)}</b><small>Room ${s.room.i} of ${s.room.of} · ${esc(s.room.diff)}${s.hints ? ` · 💡 ${s.hints} hint${s.hints === 1 ? '' : 's'}` : ''}</small></div><div class="es-clock ${lowTime ? 'low' : ''}">${timer(s.endsIn)}</div></header>
      <div class="es-main">${board}${side}</div></div>`);
    mountHazel(el);
  }
  function tvStory(el, s) {
    const O = s.outro;
    const card = s.phase === 'outro' && O ? `<div class="es-result"><div class="es-stamp big ${O.cleared ? '' : 'red'}">${O.cleared ? 'SOLVED' : 'TIME’S UP'}</div>
      ${O.culprit ? `<div class="es-culprit big">${suspectSvg(O.culprit, 130)}<div><small>The culprit</small><b>${esc(O.culprit.name)}</b><span>${esc(O.culprit.job)}</span></div></div>` : ''}
      ${O.cleared ? `<div class="es-stars big">${stars(O.stars)}</div><p>${Math.floor(O.left / 60)}:${String(O.left % 60).padStart(2, '0')} left on the clock</p>` : ''}</div>`
      : `<div class="es-chapter"><small>Chapter ${s.room.i} of ${s.room.of}</small><h1>${esc(s.room.icon)} ${esc(s.room.name)}</h1><p>${esc(s.room.diff)} · 15 minutes</p><div class="es-readyc">${s.ready} of ${s.readyOf} detectives ready</div></div>`;
    BOX.morph(el, `<div class="es-tv es-storyv scene-${esc(s.room.scene)}"><div class="es-storybox"><div class="es-hazel big" id="es-hazel" data-keep></div><div class="es-sub"><b>Hazel Finch</b><p>${esc(s.story || '')}</p></div></div>${card}</div>`);
    mountHazel(el);
  }
  function tvOver(el, s) {
    const st = s.standings || [], w = st[0] || {};
    const award = (k, label, icon) => { const r = [...st].sort((a, b) => b[k] - a[k])[0]; return r && r[k] > 0 ? `<div class="es-award"><i>${icon}</i><b>${esc(label)}</b><span>${av(r)} ${esc(r.name)}</span></div>` : ''; };
    BOX.morph(el, `<div class="es-tv es-over"><div class="es-stamp big">CASE CLOSED</div><h1>🏆 ${av(w)} ${esc(w.name || '')}, top detective</h1>
      <div class="es-hist big">${s.history.map((h) => `<div><span>${esc(h.icon)} ${esc(h.name)} <small>${esc(h.diff)}</small></span><b>${h.cleared ? stars(h.stars) : 'Hazel finished it'}</b><small>${h.culprit ? 'Culprit: ' + esc(h.culprit) : ''}</small></div>`).join('')}</div>
      <div class="es-awards">${award('opened', 'Master locksmith', '🔓')}${award('caught', 'Sharp eye', '🔎')}${award('locks', 'Team player', '🤝')}</div>
      <div class="es-board">${st.map((r, i) => `<div class="es-row"><span>${i + 1}</span><span>${av(r)} ${esc(r.name)}</span><b>${r.points}</b></div>`).join('')}</div></div>`);
  }

  function lobbyTv(el, L) {
    if (!el.querySelector('.es-lobby')) {
      el.innerHTML = `<div class="es-lobby"><div class="es-file"><div class="es-tab">CASE FILE · THE MAGPIE</div>
          <h1 class="es-logo">Just<span>Escape</span></h1><p class="es-l-tag">Detective Hazel Finch needs partners. Every phone holds a different clue.</p>
          <div class="es-l-cols"><div class="es-l-join"><img id="qr" alt="QR code to join"><div class="es-l-cl">Room code</div><div class="es-l-code" id="code"></div></div>
            <div><div class="es-l-set" id="settings"></div><div class="es-l-roster" id="roster"></div><div class="es-l-err" id="lobby-err"></div>
              <button class="es-l-start" id="start">🔍 Take the case</button><div class="es-l-links"><button class="link" id="add-bots">+ 5 test bots</button> <button class="link" id="pick">🎮 Another game</button></div></div></div></div></div>`;
      el.querySelector('#start').onclick = async () => { const r = await L.start(); el.querySelector('#lobby-err').textContent = r && r.ok ? '' : (r && r.error) || ''; };
      el.querySelector('#add-bots').onclick = () => L.bots(5);
      el.querySelector('#pick').onclick = () => L.pick();
    }
    el.querySelector('#code').textContent = L.code;
    const q = el.querySelector('#qr'); if (q.dataset.u !== L.qr) { q.src = L.qr; q.dataset.u = L.qr; }
    const set = el.querySelector('#settings'), sig = JSON.stringify(L.settings);
    if (set.dataset.sig !== sig && !set.contains(document.activeElement)) {
      set.dataset.sig = sig;
      set.innerHTML = L.fields.map((f) => `<label class="es-l-f"><span>${esc(f.label)}</span><select data-set="${esc(f.key)}">${f.options.map((o) => `<option value="${esc(String(o.value))}" ${String(L.settings[f.key]) === String(o.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`).join('');
      for (const s of set.querySelectorAll('[data-set]')) s.onchange = () => L.set(s.dataset.set, s.value);
    }
    BOX.morph(el.querySelector('#roster'), L.players.map((p) => `<span class="chip es-chip">${av(p)} ${esc(p.name)}</span>`).join('') || '<span class="muted">Scan the code to join the investigation. 2–6 detectives is perfect.</span>');
  }

  BOX.games.escape = {
    name: 'JustEscape', icon: '🗝️',
    about: 'A detective needs your help. Every phone holds a different clue: talk, unlock, catch the culprit.',
    how: [
      'Detective Hazel Finch needs partners. Each room is a chapter of her case, with a 15-minute clock.',
      'Every phone shows different evidence (a journal, a photo, a map) or the controls of a lock (a keypad, clock hands, switches, a lantern). Nobody can open a lock alone.',
      'Read your evidence out loud. Whoever has the controls enters the answer; in the dark maze, the map holder guides the lantern step by step.',
      'Stuck? Ask Hazel for a hint (it costs the team a few points).',
      'When every lock is open, read out your clues and everyone votes on the culprit. A wrong accusation costs a minute.',
      'Points: the team scores for clearing a room with time to spare; you score for locks you helped open and for catching the culprit.',
    ],
    fx: { start: 'start', go: 'start', opened: 'chime', wrong: 'buzz', accuse: 'pop', caught: 'win', wrongAccuse: 'buzz', hint: 'pop', win: 'win', timeup: 'buzz', over: 'win' },
    music: (s) => (s.phase === 'story' ? 'think' : s.phase === 'play' ? (s.accuse ? 'reveal' : 'play') : s.phase === 'outro' ? (s.outro && s.outro.cleared ? 'reveal' : 'think') : s.phase === 'over' ? 'finale' : undefined),
    lobbyTv,
    tv(el, s) {
      if (!s) return;
      if (BOX.voice && BOX.voice.preload && !TV.pre) { TV.pre = true; try { BOX.voice.preload('escape'); } catch (e) { /* no */ } }
      if (s.hazel) speak(s.hazel);
      if (s.phase === 'over') return tvOver(el, s);
      if (s.phase === 'story' || s.phase === 'outro') return tvStory(el, s);
      tvPlay(el, s);
    },
    phone,
  };
})();
