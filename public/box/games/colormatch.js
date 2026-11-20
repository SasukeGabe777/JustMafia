'use strict';
// Color Match screens. TV: a paint studio on a neutral grey wall (so colours read true). Each round
// opens with a style card, flashes the colour (a paint chip, or an object: apple, car, sunset sky…),
// hides it behind a dashed outline while phones mix, then the reveal: the target next to everyone's
// mix as split chips (target | yours), best first, with a big "% match" number on every card.
// End: the Gallery (podium frames, awards, tonight's palette). Phone: a saturation/brightness pad
// and a hue bar that live in a data-keep slot, so the shell never repaints them mid-drag; a big
// lock-in button. Prefix cm- (game) and cml- (lobby).
(function () {
  const { esc, mmss } = BOX;
  // Small recorded studio touches on the TV (public/audio/sfx/colormatch, credits there), timed to the
  // CSS: a paint splat for each new round, a cloth drops over the colour, a brush dab per lock-in,
  // applause for a perfect match, the Gallery frames knocked onto the wall. -> false if it can't play.
  const clip = (f, o) => { try { return !!(BOX.audio && BOX.audio.clip && BOX.audio.clip('colormatch/' + f + '.webm', o)); } catch { return false; } };
  const heard = { key: '', top: 0.7 };

  // ---------- colour helpers (the server re-checks everything) ----------
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  function hsvToRgb(h, s, v) {
    h = ((h % 360) + 360) % 360; s /= 100; v /= 100;
    const c = v * s, hp = h / 60, x = c * (1 - Math.abs((hp % 2) - 1)), m = v - c;
    const [r, g, b] = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
    return [r, g, b].map((t) => Math.round((t + m) * 255));
  }
  const toHex = (rgb) => '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('');
  const hsvHex = (c) => toHex(hsvToRgb(c.h, c.s, c.v));
  const lum = (hex) => { const n = parseInt(String(hex).slice(1), 16); return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
  const inkOn = (hex) => (lum(hex) > 0.6 ? '#141418' : '#ffffff');
  const bg = (c) => (Array.isArray(c) ? `linear-gradient(90deg, ${esc(c[0])} 50%, ${esc(c[1])} 50%)` : esc(c || '#444'));
  const up = (h) => esc(String(h || '').toUpperCase());

  // ---------- small shared bits ----------
  const ends = {};
  const timer = (key, endsIn) => { if (!endsIn) return ''; if (!ends[key]) ends[key] = Date.now() + endsIn; return `<span class="timer cm-timer" data-ends="${ends[key]}">${mmss(ends[key] - Date.now())}</span>`; };
  // A player's own character (BOX.face, in their beret/smock), or their emoji.
  const av = (x, px = 30) => (x && window.BOX && BOX.face ? BOX.face(x, px, { cls: 'cm-fc' }) : esc((x && x.avatar) || '🙂'));
  const avF = (x, px = 64, o = {}) => (x && window.BOX && BOX.face ? BOX.face(x, px, { fill: true, ...o }) : esc((x && x.avatar) || '🙂'));
  const hasLook = (x) => !!(x && window.BOX && BOX.body && BOX.hasLook && BOX.hasLook(x));
  // Shop gear (public/shared/gear.js, slot colormatch/easel): the frame around a player's mix on
  // the reveal and their gallery frame at the end. fr(x) → { cls, css }; empty with no gear.
  const GPAT = (p) => ({ stripes: `repeating-linear-gradient(45deg,${p.a} 0 8px,${p.b} 8px 16px)`, dots: `radial-gradient(circle,${p.c || p.b} 22%,transparent 24%) 0 0/9px 9px,radial-gradient(circle,${p.b} 22%,${p.a} 24%) 4px 4px/9px 9px`, swirl: `conic-gradient(from 30deg,${p.a},${p.b},${p.a},${p.b},${p.a})`, check: `repeating-conic-gradient(${p.a} 0 25%,${p.b} 0 50%) 0 0/12px 12px` }[p.pattern] || `linear-gradient(135deg,${p.a},${p.b},${p.a})`);
  const fr = (x) => {
    const p = window.MT_GEAR && x ? MT_GEAR.paint('colormatch', 'easel', x.gear) : null;
    return p ? { cls: ' gear' + (p.glow ? ' glow' : ''), css: `;--ga:${esc(p.a)};--gb:${esc(p.b)};--gpat:${esc(GPAT(p))}` } : { cls: '', css: '' };
  };
  function haptic(ctx, kind) { try { if (ctx.haptic) ctx.haptic(kind); else if (ctx.vibrate) ctx.vibrate(kind === 'tap' ? 8 : 40); } catch { /* no vibration */ } }
  const felt = {};
  const feel = (ctx, chan, key, kind) => { if (felt[chan] === key) return; felt[chan] = key; haptic(ctx, kind); };
  function paint(el, html, key) {
    if (el._cmKey === key && el._cmHtml === html) return false;
    el._cmKey = key; el._cmHtml = html;
    BOX.morph(el, `<div class="cm-root" id="cm-${esc(key)}">${html}</div>`);
    return true;
  }
  const KIND_TINT = { memory: '#ff4f9a', blink: '#ffd23f', two: '#3ee6ff', name: '#ff8c42', gradient: '#8b6bff', odd: '#3fd17a' };

  // ---------- the objects a colour can appear as (viewBox 0 0 200 200; details stay neutral) ----------
  const OBJ = {
    apple: (c) => `<path d="M100 60c-12-10-34-14-50-4-22 14-24 50-12 78 10 24 28 44 46 44 8 0 10-4 16-4s8 4 16 4c18 0 36-20 46-44 12-28 10-64-12-78-16-10-38-6-50 4z" fill="${c}"/><path class="d" d="M100 60c0-14 4-26 12-34" stroke="#3b3030" stroke-width="7" fill="none" stroke-linecap="round"/><path class="d" d="M110 40c10-14 28-18 40-14-4 14-20 22-40 14z" fill="#34343c"/><ellipse class="d" cx="66" cy="94" rx="9" ry="18" fill="#fff" opacity=".35" transform="rotate(20 66 94)"/>`,
    car: (c) => `<path d="M16 140V118q0-12 14-14l30-4 22-26q6-6 16-6h42q10 0 16 8l18 24 12 3q12 3 12 15v22q0 6-6 6H22q-6 0-6-6z" fill="${c}"/><path class="d" d="M68 100l18-21q3-3 8-3h20v24zM124 76h16q7 0 11 6l12 18h-39z" fill="#dfe5ec"/><path class="d" d="M120 104v36" stroke="#000" opacity=".25" stroke-width="3"/><circle class="d" cx="182" cy="116" r="5" fill="#fff6c8"/><circle class="d" cx="58" cy="146" r="20" fill="#232328"/><circle class="d" cx="58" cy="146" r="8" fill="#b9bcc4"/><circle class="d" cx="154" cy="146" r="20" fill="#232328"/><circle class="d" cx="154" cy="146" r="8" fill="#b9bcc4"/>`,
    balloon: (c) => `<path class="d" d="M100 152q-12 14 2 26t-4 22" stroke="#c9c9d1" stroke-width="3" fill="none"/><ellipse cx="100" cy="82" rx="54" ry="64" fill="${c}"/><path d="M93 144l7 10 7-10z" fill="${c}"/><ellipse class="d" cx="78" cy="58" rx="10" ry="20" fill="#fff" opacity=".35" transform="rotate(25 78 58)"/>`,
    sky: (c) => `<rect x="10" y="22" width="180" height="158" rx="18" fill="${c}"/><circle class="d" cx="128" cy="112" r="24" fill="#fff" opacity=".5"/><path class="d" d="M10 138q50-30 94-4t86-10v38q0 18-18 18H28q-18 0-18-18z" fill="#202027"/><path class="d" d="M48 66q6-6 12 0q6-6 12 0M84 52q5-5 10 0q5-5 10 0" stroke="#202027" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    mug: (c) => `<path class="d" d="M76 44q-8-10 0-20M100 44q-8-10 0-20M124 44q-8-10 0-20" stroke="#bfc0c8" stroke-width="4" fill="none" stroke-linecap="round" opacity=".7"/><path d="M144 82h12q22 0 22 26t-22 26h-12" stroke="${c}" stroke-width="14" fill="none"/><path d="M42 58h104v86q0 30-30 30H72q-30 0-30-30z" fill="${c}"/><rect class="d" x="56" y="72" width="10" height="60" rx="5" fill="#fff" opacity=".3"/>`,
    umbrella: (c) => `<path class="d" d="M100 100v64q0 14-14 14-12 0-12-12" stroke="#2c2c33" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M14 108Q16 32 100 28q84 4 86 80-13-12-26 0-14-12-29 0-15-12-31 0-15-12-29 0-14-12-29 0-14-12-29 0z" fill="${c}"/><path class="d" d="M100 28Q72 60 71 108M100 28q28 32 29 80M100 28v80" stroke="#000" stroke-width="2.5" fill="none" opacity=".2"/><circle class="d" cx="100" cy="24" r="5" fill="#2c2c33"/>`,
    fish: (c) => `<path d="M136 100l46-34-9 34 9 34z" fill="${c}"/><path d="M22 100q52-62 120 0-68 62-120 0z" fill="${c}"/><path d="M80 62q18-20 40-8l-10 18z" fill="${c}"/><path class="d" d="M86 84q8 16 0 32M104 80q8 20 0 40" stroke="#000" stroke-width="3" fill="none" opacity=".18"/><circle class="d" cx="54" cy="94" r="9" fill="#fff"/><circle class="d" cx="52" cy="94" r="4.5" fill="#15151a"/>`,
    shirt: (c) => `<path d="M62 36l24-8q14 16 28 0l24 8 38 32-22 28-14-10v86H60V86l-14 10-22-28z" fill="${c}"/><path class="d" d="M86 28q14 18 28 0" stroke="#000" stroke-width="4" fill="none" opacity=".25"/><path class="d" d="M60 86v-6M140 86v-6" stroke="#000" stroke-width="3" opacity=".2"/>`,
  };
  const objSvg = (key, c, cls = '') => `<svg class="cm-obj ${cls}" viewBox="0 0 200 200" aria-hidden="true">${(OBJ[key] || OBJ.apple)(esc(c))}</svg>`;
  // A paint chip (hardware-store style): colour on top, a printed strip underneath.
  const chip = (c, label, cls = '', inner = '') => `<div class="cm-chip ${cls}"><div class="cm-chip-c" style="background:${bg(c)}">${inner}</div><div class="cm-chip-l">${label}</div></div>`;

  // ---------- TV ----------
  function hud(s) {
    const dots = [];
    for (let i = 0; i < s.of; i++) {
      const c = s.palette[i];
      dots.push(c ? `<i class="done" style="background:${bg(c)}"></i>` : i === s.round - 1 ? '<i class="now">?</i>' : '<i></i>');
    }
    const lead = s.standings[0];
    return `<div class="cm-hud"><div class="cm-hr"><span class="cm-hround">Round <b>${s.round}</b> / ${s.of}</span><span class="cm-hkind" style="--k:${KIND_TINT[s.cur.kind] || '#fff'}">${esc(s.cur.icon)} ${esc(s.cur.title)}</span>${s.cur.final ? '<span class="cm-x2">×2 FINAL ROUND</span>' : ''}</div>
      <div class="cm-pal" title="Tonight's palette">${dots.join('')}</div>
      <div class="cm-hlead">${lead && lead.points ? `👑 ${av(lead)} <b>${esc(lead.name)}</b> ${lead.points.toLocaleString('en-US')}` : '🎨 Paint studio open'}</div></div>`;
  }
  function locks(s) {
    if (!s.chips || !s.chips.length) return '';
    const many = s.chips.length > 14 ? 'many' : '';
    return `<div class="cm-locks ${many}">${s.chips.map((p) => `<span class="cm-lk ${p.in ? 'in' : ''}" style="--c:${esc(p.color || '#888')}"><span class="a">${avF(p, 48)}</span><b>${esc(p.name)}</b></span>`).join('')}</div>
      <div class="cm-lcount">${s.locked} / ${s.players} locked in${s.locked === s.players && s.players ? ' 🎉' : ''}</div>`;
  }
  function tvIntro(s) {
    const c = s.cur;
    return `<div class="cm-intro" style="--k:${KIND_TINT[c.kind]}"><div class="cm-splat"><svg viewBox="0 0 200 200"><path d="M100 18c14 0 18 18 30 20s26-10 34 2-6 22 0 34 22 14 20 28-20 12-24 24 8 28-4 36-24-6-36 0-14 22-28 20-12-18-24-22-28 8-36-2 6-22 0-34-20-14-18-28 20-12 22-24-6-28 6-36 22 6 34 0 12-18 24-18z" fill="var(--k)"/></svg><span>${esc(c.icon)}</span></div>
      <div class="cm-ititle">${esc(c.title)}</div><div class="cm-irule">${esc(c.rule)}</div>
      ${c.final ? '<div class="cm-ifinal">🏁 Final round · double points!</div>' : `<div class="cm-iround">Round ${s.round} of ${s.of}</div>`}</div>`;
  }
  function lookVisual(c, s, big = true) {
    if (c.kind === 'two') return `<div class="cm-two">${chip(c.target[0], '<b>1</b>', 'big')}${chip(c.target[1], '<b>2</b>', 'big')}</div>`;
    if (c.obj) return `<div class="cm-objwrap">${objSvg(c.obj, c.target)}</div>`;
    return chip(c.target, `<b>Color Match</b> No. ${s.round}`, big ? 'big' : '');
  }
  function tvLook(s) {
    const c = s.cur;
    return `<div class="cm-look ${c.kind}"><div class="cm-ltag">${c.kind === 'blink' ? '⚡ BLINK!' : '👀 MEMORISE IT!'}</div>
      <div class="cm-lvis">${lookVisual(c, s)}</div>
      <div class="cm-drain"><i style="animation-duration:${c.lookMs || 3000}ms"></i></div></div>`;
  }
  function tvPick(s, key) {
    const c = s.cur, t = timer('t' + key, s.endsIn);
    let vis = '', ask = '';
    if (c.kind === 'name') { vis = chip('#2a2a31', `<b>${esc(c.name)}</b>`, 'big name', '<span class="q">?</span>'); ask = `What does <b>${esc(c.name)}</b> look like? Mix it!`; }
    else if (c.kind === 'gradient') { vis = `<div class="cm-gradrow"><div class="cm-gend" style="background:${esc(c.ends[0])}"></div><div class="cm-garrow">→</div><div class="cm-gmid">?</div><div class="cm-garrow">←</div><div class="cm-gend" style="background:${esc(c.ends[1])}"></div></div>`; ask = 'Mix the colour exactly <b>halfway</b> between these two!'; }
    else if (c.kind === 'odd') { vis = `<div class="cm-grid">${c.tiles.map((x) => `<i style="background:${esc(x)}"></i>`).join('')}</div>`; ask = 'One tile is different. Find it on your phone, fast!'; }
    else if (c.kind === 'two') { vis = `<div class="cm-two ghost">${chip('#2a2a31', '<b>1</b>', 'big', '<span class="q">?</span>')}${chip('#2a2a31', '<b>2</b>', 'big', '<span class="q">?</span>')}</div>`; ask = 'Mix <b>both</b> colours from memory!'; }
    else if (c.obj) { vis = `<div class="cm-objwrap">${objSvg(c.obj, 'transparent', 'ghost')}<span class="q">?</span></div>`; ask = 'Mix it from memory on your phone!'; }
    else { vis = chip('#2a2a31', `<b>Color Match</b> No. ${s.round}`, 'big', '<span class="q">?</span>'); ask = 'Mix it from memory on your phone!'; }
    return `<div class="cm-pick ${c.kind}"><div class="cm-pvis">${vis}</div><div class="cm-ask">${ask}</div><div class="cm-ptimer">${t}</div>${locks(s)}</div>`;
  }
  // The reveal: the target on the left, everyone's split chips on the right (best first).
  function revealTarget(r, s) {
    if (r.kind === 'odd') return `<div class="cm-rlab">The odd one out</div><div class="cm-grid reveal">${r.tiles.map((x, i) => `<i class="${i === r.odd ? 'odd' : ''}" style="background:${esc(x)}">${r.counts[i] ? `<span>${r.counts[i]}</span>` : ''}</i>`).join('')}</div>`;
    if (r.kind === 'name') {
      return `<div class="cm-rlab">${r.crowd ? 'The room’s' : 'Our'} “${esc(r.name)}”</div>${chip(r.target || '#444', `<b>${esc(r.name)}</b> ${up(r.target)}`, 'big')}
        ${r.crowd ? `<div class="cm-ref"><div><span class="cm-dot" style="background:${esc(r.ref)}"></span> Our paint chip: <b>${up(r.ref)}</b></div><div class="cm-refsub">Scored against the room’s average</div></div>` : ''}`;
    }
    if (r.kind === 'gradient') return `<div class="cm-rlab">Halfway was…</div><div class="cm-gradrow reveal"><div class="cm-gend" style="background:${esc(r.ends[0])}"></div><div class="cm-gmid" style="background:${esc(r.target)}"></div><div class="cm-gend" style="background:${esc(r.ends[1])}"></div></div><div class="cm-hex">${up(r.target)}</div>`;
    if (r.kind === 'two') return `<div class="cm-rlab">It was…</div><div class="cm-two">${chip(r.target[0], `<b>1</b> ${up(r.target[0])}`, 'big')}${chip(r.target[1], `<b>2</b> ${up(r.target[1])}`, 'big')}</div>`;
    if (r.obj) return `<div class="cm-rlab">It was…</div><div class="cm-objwrap">${objSvg(r.obj, r.target)}</div><div class="cm-hex">${up(r.target)}</div>`;
    return `<div class="cm-rlab">It was…</div>${chip(r.target, `<b>Color Match</b> No. ${r.round} · ${up(r.target)}`, 'big')}`;
  }
  function split(t, g) { return `<div class="cm-split"><i style="background:${esc(t)}"></i><i style="background:${esc(g)}"></i></div>`; }
  function revealCard(r, e, i, n, step) {
    const delay = 700 + (n - 1 - i) * step;
    let sw = '', meta = '';
    if (r.kind === 'odd') {
      sw = `<div class="cm-split one"><i style="background:${esc(r.tiles[e.i])}"></i></div>`;
      meta = e.correct ? `✅ Found it · ${e.secs.toFixed(1)} s` : `❌ Tile ${e.i + 1}`;
    } else {
      const tg = [].concat(r.target);
      sw = tg.map((t, k) => split(t, e.picks[k] || e.picks[0])).join('');
      meta = e.late ? '⏰ time ran out' : `locked at ${(e.ms / 1000).toFixed(1)} s`;
      if (e.parts) meta = e.parts.map((p, k) => `${k + 1}: ${p}%`).join(' · ');
    }
    const pct = r.kind === 'odd' ? (e.correct ? '✓' : '✗') : `${e.pct}<small>%</small>`;
    return `<div class="cm-card ${i === 0 ? 'top' : ''} ${e.perfect ? 'perfect' : ''}" style="animation-delay:${delay}ms">
      <span class="cm-rank">${i === 0 ? '👑' : i + 1}</span><div class="cm-sws${fr(e).cls}" style="${fr(e).css.slice(1)}">${sw}</div>
      <div class="cm-who"><b>${av(e)} ${esc(e.name)}</b><span>${meta}</span></div>
      <div class="cm-pct" aria-label="${r.kind === 'odd' ? '' : e.pct + ' percent match'}">${pct}${r.kind === 'odd' ? '' : '<em>match</em>'}</div>
      <div class="cm-gain">+${e.pts.toLocaleString('en-US')}${e.perfect ? `<span class="cm-perf">✨ ${r.kind === 'odd' ? 'SPOT ON' : 'PERFECT'}${e.combo > 1 ? ` 🔥×${e.combo}` : ''}</span>` : ''}</div>
      ${r.kind === 'odd' ? '' : `<div class="cm-bar"><i style="width:${e.pct}%"></i></div>`}</div>`;
  }
  function tvReveal(s) {
    const r = s.result, list = r.entries.slice(0, 20), n = list.length, step = Math.max(110, Math.min(420, 3600 / Math.max(1, n)));
    const size = n <= 6 ? 'big' : n <= 12 ? 'mid' : 'small';
    const notes = [];
    if (!n) notes.push('🤷 Nobody mixed anything this time!');
    if (r.perfects) notes.push(`✨ ${r.perfects} perfect ${r.kind === 'odd' ? (r.perfects > 1 ? 'spots' : 'spot') : (r.perfects > 1 ? 'matches' : 'match')}!`);
    if (r.kind !== 'odd' && n >= 2) { const avg = Math.round(r.entries.reduce((a, e) => a + e.pct, 0) / r.entries.length); notes.push(`Room average: <b>${avg}%</b>`); }
    if (r.kind === 'odd' && n) { const f = r.entries.filter((e) => e.correct).length; notes.push(`<b>${f}</b> of ${r.entries.length} spotted it`); }
    if (r.final) notes.push('×2 final round');
    return `<div class="cm-reveal"><section class="cm-rt">${revealTarget(r, s)}<div class="cm-notes">${notes.map((x) => `<span>${x}</span>`).join('')}</div></section>
      <section class="cm-list ${size}">${list.map((e, i) => revealCard(r, e, i, n, step)).join('')}${r.entries.length > 20 ? `<div class="cm-more">+${r.entries.length - 20} more on their phones</div>` : ''}</section></div>`;
  }
  function tvOver(s) {
    const f = s.final || { awards: [], palette: [] }, st = s.standings, order = [1, 0, 2];
    const pod = order.filter((i) => st[i]).map((i) => `<div class="cm-frame p${i + 1}${fr(st[i]).cls}" style="--c:${esc(st[i].color || '#888')};animation-delay:${[0.9, 0.3, 1.3][i]}s${fr(st[i]).css}"><div class="cm-canvas">${hasLook(st[i]) ? `<span class="cm-fig">${BOX.body(st[i], 260, i === 0 ? { mood: 'grin' } : {})}</span>` : `<span>${esc(st[i].avatar || '🙂')}</span>`}</div><div class="cm-plaque"><b>${['🥇', '🥈', '🥉'][i]} ${esc(st[i].name)}</b><span>${st[i].points.toLocaleString('en-US')} pts</span></div></div>`).join('');
    const aw = f.awards.map((a, i) => `<div class="cm-award" style="animation-delay:${2 + i * 0.3}s"><div class="ic">${a.icon}</div><div class="t">${esc(a.title)}</div><div class="nm">${av(a)} ${esc(a.name)}</div><div class="tx">${esc(a.text)}</div></div>`).join('');
    const pal = f.palette.map((p, i) => `<div class="cm-pchip" style="animation-delay:${0.2 + i * 0.08}s"><i style="background:${bg(p.c)}"></i><span>${i + 1}</span></div>`).join('');
    const rest = st.slice(3, 12).map((r, i) => `<div class="cm-brow"><span class="n">${i + 4}</span><span>${av(r)} ${esc(r.name)}</span><b>${r.points.toLocaleString('en-US')}</b></div>`).join('');
    return `<div class="cm-over"><h1 class="cm-oh-w"><span class="cm-oh-ic">🖼️</span> <span class="cm-oh">The Gallery</span></h1><div class="cm-osub">${st[0] ? `<b>${esc(st[0].name)}</b> has the sharpest eye in the room!` : ''}</div>
      <div class="cm-podium">${pod}</div>
      ${aw ? `<div class="cm-awards">${aw}</div>` : ''}
      <div class="cm-obot"><div class="cm-night"><div class="cm-nlab">Tonight’s palette</div><div class="cm-pchips">${pal}</div></div>${rest ? `<div class="cm-rest">${rest}</div>` : ''}</div></div>`;
  }

  // ---------- phone ----------
  let mix = null, dragging = false, skipped = false, celebrated = '', lastSend = 0;
  function newMix(key, round) {
    const h0 = (round * 137 + 40) % 360;
    mix = { key, active: 0, cols: [{ h: h0, s: 55, v: 72 }, { h: (h0 + 160) % 360, s: 55, v: 72 }] };
  }
  function pickerHtml(v) {
    const c = v.cur;
    let prev = '';
    if (c.kind === 'two') prev = `<div class="cm-pv two"><button class="cm-sw tab on" data-i="0"><span>1</span></button><button class="cm-sw tab" data-i="1"><span>2</span></button></div><div class="cm-tabhint">Tap 1 or 2 to switch colours</div>`;
    else if (c.kind === 'name') prev = `<div class="cm-pv name"><div class="cm-sw" data-i="0"></div><div class="cm-pvl"><small>Mix this colour</small><b>${esc(c.name)}</b></div></div>`;
    else if (c.kind === 'gradient') prev = `<div class="cm-pv grad"><i style="background:${esc(c.ends[0])}"></i><div class="cm-sw" data-i="0"></div><i style="background:${esc(c.ends[1])}"></i></div><div class="cm-tabhint">Your mix sits in the middle: make it halfway</div>`;
    else prev = `<div class="cm-pv one"><div class="cm-sw" data-i="0"><span>Your mix</span></div></div>`;
    return `${prev}<div class="cm-sv" id="cm-sv"><div class="cm-sv-w"></div><div class="cm-sv-b"></div><b class="cm-knob" id="cm-svk"></b></div>
      <div class="cm-hue" id="cm-hue"><b class="cm-knob" id="cm-hk"></b></div>
      <div class="cm-read" id="cm-read"></div>
      <button class="cm-lock" id="cm-lock">🔒 Lock it in</button>`;
  }
  function showMix(slot) {
    const c = mix.cols[mix.active];
    for (const sw of slot.querySelectorAll('.cm-sw[data-i]')) { const i = Number(sw.dataset.i); sw.style.background = hsvHex(mix.cols[i]); sw.style.color = inkOn(hsvHex(mix.cols[i])); sw.classList.toggle('on', i === mix.active); }
    const sv = slot.querySelector('#cm-sv'); sv.style.background = `hsl(${c.h}, 100%, 50%)`;
    const k = slot.querySelector('#cm-svk'); k.style.left = c.s + '%'; k.style.top = (100 - c.v) + '%'; k.style.background = hsvHex(c);
    const hk = slot.querySelector('#cm-hk'); hk.style.left = (c.h / 360) * 100 + '%'; hk.style.background = `hsl(${c.h}, 100%, 50%)`;
    slot.querySelector('#cm-read').innerHTML = `<span>Hue <b>${Math.round(c.h)}°</b></span><span>Sat <b>${Math.round(c.s)}%</b></span><span>Bright <b>${Math.round(c.v)}%</b></span><span class="hx">${hsvHex(c).toUpperCase()}</span>`;
  }
  function sendDraft(ctx, force) {
    const now = Date.now(); if (!force && now - lastSend < 250) return; lastSend = now;
    try { ctx.act({ op: 'mix', colors: mix.cols.slice(0, mix.n).map(({ h, s, v }) => ({ h, s, v })) }); } catch { /* offline */ }
  }
  function bindPicker(slot, v, ctx) {
    const sv = slot.querySelector('#cm-sv'), hue = slot.querySelector('#cm-hue');
    const drag = (el, fn) => {
      el.onpointerdown = (e) => { dragging = true; try { el.setPointerCapture(e.pointerId); } catch { /* old browser */ } fn(e); e.preventDefault(); };
      el.onpointermove = (e) => { if (dragging) fn(e); };
      const stop = () => { if (!dragging) return; dragging = false; haptic(ctx, 'select'); sendDraft(ctx, true); if (skipped) { skipped = false; ctx.redraw && ctx.redraw(); } };
      el.onpointerup = stop; el.onpointercancel = stop; el.onlostpointercapture = stop;
    };
    drag(sv, (e) => {
      const r = sv.getBoundingClientRect(), c = mix.cols[mix.active];
      c.s = clamp(((e.clientX - r.left) / Math.max(1, r.width)) * 100, 0, 100); c.v = clamp(100 - ((e.clientY - r.top) / Math.max(1, r.height)) * 100, 0, 100);
      showMix(slot);
    });
    drag(hue, (e) => {
      const r = hue.getBoundingClientRect(), c = mix.cols[mix.active], was = c.h;
      c.h = clamp(((e.clientX - r.left) / Math.max(1, r.width)) * 360, 0, 359.9);
      if (Math.floor(was / 30) !== Math.floor(c.h / 30)) haptic(ctx, 'tap');
      showMix(slot);
    });
    for (const t of slot.querySelectorAll('.cm-sw.tab')) t.onclick = () => { mix.active = Number(t.dataset.i); haptic(ctx, 'tap'); showMix(slot); };
    const lock = slot.querySelector('#cm-lock');
    lock.onclick = async () => {
      if (lock.disabled) return; lock.disabled = true; lock.textContent = 'Locking…';
      const r = await ctx.act({ op: 'lock', colors: mix.cols.slice(0, mix.n).map(({ h, s, v }) => ({ h, s, v })) });
      if (r && r.ok) { haptic(ctx, 'success'); ctx.sfx('pop'); ctx.redraw && ctx.redraw(); } else { lock.disabled = false; lock.textContent = '🔒 Lock it in'; }
    };
    showMix(slot);
  }
  const verdict = (p) => (p >= 96 ? 'Flawless eye! 🦅' : p >= 90 ? 'So close! 🤏' : p >= 80 ? 'Nicely mixed! 🎨' : p >= 65 ? 'In the neighbourhood 🏘️' : 'A bold interpretation 🖌️');

  // ---------- TV lobby: a paint studio. Settings are paint tins; players hang as paint chips ----------
  const POTS = {
    rounds: { lab: 'Rounds', colors: ['#ffd23f', '#ff8c42', '#ff4f5e'], opts: { 5: '5', 7: '7', 10: '10' } },
    seconds: { lab: 'Time to mix', colors: ['#7be0ff', '#3ea6ff', '#5b5bf0'], opts: { 15: '15 s', 20: '20 s', 30: '30 s' } },
    styles: { lab: 'Round styles', colors: ['rainbow', '#ff4f9a'], opts: { mix: 'All styles', memory: 'Memory only' } },
    showIntro: { lab: 'Intro', colors: ['#3fd17a', '#8d8d99'], opts: { true: 'On', false: 'Skip' } },
  };
  const LOGO = 'Color Match'.split('').map((ch, i) => (ch === ' ' ? ' ' : `<span style="--c:${['#ff4f5e', '#ff8c42', '#ffd23f', '#3fd17a', '#3ee6ff', '', '#3ea6ff', '#8b6bff', '#ff4f9a', '#ff8c42', '#ffd23f'][i]};--d:${i * 0.09}s">${ch}</span>`)).join('');
  function lobbyTv(el, L) {
    el.__L = L;
    if (!el.__cml) {
      el.__cml = true;
      el.innerHTML = `<div class="cml"><div class="cml-splats" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <header class="cml-head"><h1 class="cml-logo">${LOGO}</h1><div class="cml-tag">See it. Remember it. Mix it.</div></header>
        <section class="cml-shelf"><div class="cml-shelf-t">🎨 Mix your settings</div><div id="cml-pots" class="cml-pots"></div><div id="settings" class="cml-sr"></div></section>
        <aside class="cml-join"><div class="cml-jt">📱 Join on your phone</div><img id="qr" alt="QR code to join"><div class="cml-url" id="cml-url"></div>
          <div class="cml-cap">ROOM CODE</div><div class="cml-code" id="code"></div><div class="cml-vip" id="cml-vip"></div><div class="err" id="lobby-err"></div>
          <button class="cml-start" id="start">🖌️ Start mixing</button>
          <div class="cml-links"><button id="add-bots">+ 5 test bots</button><button id="cml-rm">remove bots</button><button id="cml-pick">🎮 Other game</button></div></aside>
        <section class="cml-wall"><div class="cml-wt"><span>Paint chips on the wall</span><b id="cml-count"></b></div><div class="cml-roster" id="roster"></div></section>
        <div class="cml-party" id="cml-party"></div></div>`;
      const $ = (s) => el.querySelector(s);
      $('#start').onclick = async () => { const r = await el.__L.start(); $('#lobby-err').textContent = r && r.ok ? '' : (r && r.error) || ''; };
      $('#add-bots').onclick = () => el.__L.bots(5);
      $('#cml-rm').onclick = () => el.__L.removeBots();
      $('#cml-pick').onclick = () => el.__L.pick();
      el.addEventListener('click', (e) => {
        const k = e.target.closest('[data-k]');
        if (k) {
          for (const b of k.parentNode.querySelectorAll('.cml-pot')) b.classList.toggle('on', b === k);
          const s = el.querySelector(`select[data-set="${k.dataset.k}"]`); if (s) s.value = k.dataset.v;
          el.__L.set(k.dataset.k, k.dataset.v); if (!clip('brush', { vol: 0.28 })) BOX.sfx('pop'); return;
        }
        const c = e.target.closest('[data-kick]');
        if (c && confirm('Remove this player?')) el.__L.kick(c.dataset.kick);
      });
    }
    const $ = (s) => el.querySelector(s);
    if ($('#code').textContent !== L.code) $('#code').innerHTML = L.code.split('').map((ch, i) => `<span style="--c:${['#ff4f5e', '#ffd23f', '#3ee6ff', '#3fd17a'][i % 4]}">${esc(ch)}</span>`).join('');
    if ($('#qr').dataset.u !== L.joinUrl) { $('#qr').src = L.qr; $('#qr').dataset.u = L.joinUrl; }
    $('#cml-url').textContent = L.joinUrl.replace(/^https?:\/\//, '');
    const n = L.players.length;
    $('#start').disabled = n < L.min;
    $('#cml-vip').innerHTML = L.vip ? `👑 <b>${esc(L.vip)}</b> can start from their phone` : n < L.min ? `Need ${L.min - n} more player${L.min - n === 1 ? '' : 's'}…` : 'The first to join is the host 👑';
    $('#cml-count').textContent = n ? `${n} player${n === 1 ? '' : 's'}` : '';
    const html = L.fields.map((f) => {
      const P = POTS[f.key] || { lab: f.label, colors: [], opts: {} }, cur = String(L.settings[f.key]);
      return `<div class="cml-row"><div class="cml-tape">${esc(P.lab)}</div><div class="cml-tins">${f.options.map((o, i) => {
        const col = P.colors[i] || ['#ff4f9a', '#3ee6ff', '#ffd23f', '#3fd17a'][i % 4];
        return `<button class="cml-pot ${String(o.value) === cur ? 'on' : ''} ${col === 'rainbow' ? 'rainbow' : ''}" data-k="${esc(f.key)}" data-v="${esc(String(o.value))}" style="--p:${col === 'rainbow' ? '#ff4f9a' : esc(col)}" title="${esc(o.label)}"><span class="tin"><i></i></span><b>${esc(P.opts[String(o.value)] || o.label)}</b></button>`;
      }).join('')}</div></div>`;
    }).join('');
    const pots = $('#cml-pots'); if (pots.__h !== html) { pots.__h = html; BOX.morph(pots, html); }
    const box = $('#settings'), sig = L.fields.map((f) => f.key + ':' + f.options.map((o) => o.value).join('|')).join(';');
    if (box.__sig !== sig) { box.__sig = sig; box.innerHTML = L.fields.map((f) => `<label>${esc(f.label)}<select data-set="${esc(f.key)}">${f.options.map((o) => `<option value="${esc(String(o.value))}">${esc(o.label)}</option>`).join('')}</select></label>`).join(''); }
    for (const s of box.querySelectorAll('select[data-set]')) {
      if (document.activeElement !== s) s.value = String(L.settings[s.dataset.set]);
      s.onchange = () => { s.blur(); el.__L.set(s.dataset.set, s.value); };
    }
    const r = $('#roster');
    r.classList.toggle('many', n > 10 && n <= 24); r.classList.toggle('lots', n > 24);
    const rh = n ? L.players.map((p, i) => `<span class="chip cml-chip ${p.online ? '' : 'off'}" data-kick="${esc(p.id)}" title="Click to remove" style="--c:${esc(p.color || '#ff4f9a')};--r:${((i * 37) % 9) - 4}deg;--d:${((i * 0.29) % 2.2).toFixed(2)}s"><i class="sw"><span>${avF(p, 80)}</span></i><b>${esc(p.name)}</b><small>${esc(String(p.color || '').toUpperCase())}</small></span>`).join('')
      : '<div class="cml-empty">Scan the code to hang your paint chip on the wall! 👉</div>';
    if (r.__h !== rh) { r.__h = rh; BOX.morph(r, rh); }
    const lp = $('#cml-party'), lh = L.lineupHtml || ''; if (lp.__h !== lh) { lp.__h = lh; lp.innerHTML = lh; }
  }

  BOX.games.colormatch = {
    name: 'Color Match', icon: '🎨', lobbyTv,
    music: (s) => ({ intro: 'play', look: 'play', pick: 'think', reveal: 'reveal', over: 'finale' }[s.phase] || 'play'),
    about: 'A colour flashes on the TV for three seconds. Mix it from memory on your phone. Closest match wins!',
    how: [
      'Watch the TV: a colour appears for about 3 seconds (sometimes as an apple, a car or a sunset sky), then it’s gone.',
      'Mix it from memory on your phone: drag the hue bar, then the brightness pad. Lock it in!',
      'Everyone’s mix appears next to the real colour with a % match. Closer = more points.',
      'Watch for Blink (1 second!), Two-Tone, Name It, Halfway There and Odd One Out rounds.',
      'A perfect match (96%+) builds a 🔥 combo. The last round is worth double!',
    ],
    // round, hide, lock and perfect are recorded sounds in onFx (these synth sounds are the fallback)
    fx: { look: 'swell', allin: 'chime', reveal: 'reveal', win: 'win' },
    onFx(f) {
      const fb = { round: 'whoosh', hide: 'poof', lock: 'pop', perfect: 'cheer' }[f.kind]; if (!fb) return;
      let ok;
      if (f.kind === 'round') ok = clip('splat', { vol: 0.22, delay: 0.12 }); // the splat card pops in (cmPop .7s)
      else if (f.kind === 'hide') ok = clip('cloth', { vol: 0.22 }); // a dust sheet over the colour
      else if (f.kind === 'lock') ok = clip('brush', { vol: 0.16, gap: 120 }); // a brush dab per lock-in
      else ok = clip('applause', { vol: 0.14, delay: heard.top + 0.3 }); // as the best card (a perfect one) lands
      if (!ok && !(f.kind === 'round' && BOX.audio && BOX.audio.stinger('round', 'colormatch'))) BOX.sfx(fb);
    },

    tv(el, s) {
      if (!s) return;
      if (s.phase === 'over') {
        paint(el, tvOver(s), 'over');
        // the Gallery: each podium frame pops onto the wall (0.3 / 0.9 / 1.3 s + cmPop), then polite applause
        if (heard.key !== 'over') { heard.key = 'over'; const n = Math.min(3, (s.standings || []).length); [0.5, 1.1, 1.5].slice(0, n).forEach((d, i) => clip(i ? 'frame' + (i + 1) : 'frame', { vol: 0.22, delay: d })); clip('applause', { vol: 0.15, delay: 1.8 }); }
        return;
      }
      const key = s.round + '-' + s.phase;
      heard.key = key;
      if (s.phase === 'reveal' && s.result) { const n = Math.min(20, s.result.entries.length), step = Math.max(110, Math.min(420, 3600 / Math.max(1, n))); heard.top = (700 + Math.max(0, n - 1) * step) / 1000; }
      let main = '';
      if (s.phase === 'intro') main = tvIntro(s);
      else if (s.phase === 'look') main = tvLook(s);
      else if (s.phase === 'pick') main = tvPick(s, key);
      else if (s.phase === 'reveal' && s.result) main = tvReveal(s);
      paint(el, `<div class="cm-tv">${hud(s)}<main class="cm-main">${main}</main></div>`, key);
    },

    phone(el, v, ctx, full) {
      if (!v) return;
      if (dragging) { skipped = true; return; } // never repaint under a finger
      const head = `<div class="cm-me"><span>🎨 <b>${v.points.toLocaleString('en-US')}</b> pts · #${v.rank || '-'}</span>${v.combo > 0 ? `<span class="cm-fire">🔥×${v.combo}</span>` : ''}<span class="muted">${v.phase === 'over' ? 'Final' : `Round ${v.round}/${v.of}`}</span></div>`;
      const c = v.cur || {}, key = v.round + '-' + v.phase;
      if (v.phase === 'over') {
        const st = v.standings || [], me = v.rank;
        const aw = (v.myAwards || []).map((a) => `<div class="cm-myaw"><span>${a.icon}</span><div><b>${esc(a.title)}</b><small>${esc(a.text)}</small></div></div>`).join('');
        paint(el, `${head}<div class="cm-ph-over"><div class="cm-ph-place">${me === 1 ? '🏆' : me === 2 ? '🥈' : me === 3 ? '🥉' : '🎨'}</div><h2>${me === 1 ? 'Sharpest eye in the room!' : `You finished #${me}`}</h2><p>${v.points.toLocaleString('en-US')} points</p>
          ${v.myBest ? `<p class="muted">Your best: <b>${v.myBest.pct}%</b> on ${esc(v.myBest.label)}</p>` : ''}${aw}
          <div class="cm-ph-board">${st.map((r, i) => `<div class="cm-brow ${full && full.me && r.id === full.me.id ? 'me' : ''}"><span class="n">${i + 1}</span><span>${av(r)} ${esc(r.name)}</span><b>${r.points.toLocaleString('en-US')}</b></div>`).join('')}</div></div>`, 'over');
        if (celebrated !== 'over') { celebrated = 'over'; haptic(ctx, me === 1 ? 'win' : 'success'); }
        return;
      }
      if (celebrated === 'over') celebrated = '';
      if (v.phase === 'intro') {
        feel(ctx, 'round', v.round, 'tap');
        paint(el, `${head}<div class="cm-ph-intro" style="--k:${KIND_TINT[c.kind]}"><div class="ic">${esc(c.icon)}</div><h2>${esc(c.title)}</h2><p>${esc(c.rule)}</p>${c.final ? '<div class="cm-ph-x2">🏁 Final round · double points!</div>' : ''}<div class="cm-ph-eyes">${LOOK_KINDS.has(c.kind) ? '👀 Eyes on the TV…' : 'Get ready to mix…'}</div></div>`, key);
        return;
      }
      if (v.phase === 'look') {
        feel(ctx, 'look', v.round, 'turn');
        paint(el, `${head}<div class="cm-ph-look"><div class="eye">👁️</div><h2>Look at the TV!</h2><p>${c.kind === 'blink' ? 'Blink and you’ll miss it…' : c.kind === 'two' ? 'Remember BOTH colours!' : 'Remember this colour!'}</p></div>`, key);
        return;
      }
      if (v.phase === 'pick') {
        const t = timer('p' + key, v.endsIn);
        if (v.locked) {
          const mine = c.kind === 'odd' ? '' : (v.mine || []).map((x) => `<i style="background:${esc(x)}"></i>`).join('');
          paint(el, `${head}<div class="cm-ph-locked"><div class="cm-lockedsw">${c.kind === 'odd' ? `<div class="cm-oddmine">Tile <b>${(v.myTile || 0) + 1}</b></div>` : mine}</div><h2>🔒 Locked in!</h2><p>${v.locked && v.players - v.locked > 0 ? `Waiting for ${v.players - v.locked} more… ${t}` : 'Everyone’s in!'}</p></div>`, key + '-locked');
          return;
        }
        feel(ctx, 'pick', v.round, 'select');
        if (c.kind === 'odd') {
          paint(el, `${head}<div class="cm-ph-q"><span>🔍 Tap the <b>odd one out</b>!</span> ${t}</div><div class="cm-ph-grid">${c.tiles.map((x, i) => `<button data-t="${i}" style="background:${esc(x)}" aria-label="Tile ${i + 1}"></button>`).join('')}</div><p class="muted cm-ph-hint">One tile is very slightly different. Faster finds score more.</p>`, key);
          for (const b of el.querySelectorAll('[data-t]')) b.onclick = async () => { const r = await ctx.act({ op: 'odd', i: Number(b.dataset.t) }); if (r && r.ok) { haptic(ctx, 'success'); ctx.redraw && ctx.redraw(); } };
          return;
        }
        const q = c.kind === 'name' ? 'What does this name look like?' : c.kind === 'gradient' ? 'Mix the halfway colour' : c.kind === 'two' ? 'Mix both colours from memory' : 'Mix it from memory';
        if (!mix || mix.key !== key) newMix(key, v.round);
        mix.n = c.kind === 'two' ? 2 : 1;
        paint(el, `${head}<div class="cm-ph-q">${q} ${t}</div><div class="cm-picker" id="cm-pk-${esc(key)}" data-keep></div>`, key);
        const slot = el.querySelector('.cm-picker');
        if (slot && !slot.firstChild) { slot.innerHTML = pickerHtml(v); bindPicker(slot, v, ctx); }
        return;
      }
      if (v.phase === 'reveal' && v.result) {
        const r = v.result, me = v.me;
        let body = '';
        if (!me) body = '<div class="cm-ph-none">You sat this one out. Next one! 🎨</div>';
        else if (r.kind === 'odd') {
          body = `<div class="cm-ph-grid small">${r.tiles.map((x, i) => `<i class="${i === r.odd ? 'odd' : ''} ${i === me.i ? 'mine' : ''}" style="background:${esc(x)}"></i>`).join('')}</div>
            <div class="cm-ph-big">${me.correct ? `✅ Found it in ${me.secs.toFixed(1)} s!` : `❌ It was tile ${r.odd + 1}`}</div>`;
        } else {
          const tg = [].concat(r.target);
          body = `<div class="cm-cmp">${tg.map((t, k) => `<div class="cm-cmp-row"><div><i style="background:${esc(t)}"></i><span>${r.kind === 'name' && r.crowd ? 'Room' : 'Target'}</span></div><div><i style="background:${esc(me.picks[k] || me.picks[0])}"></i><span>You</span></div></div>`).join('')}</div>
            <div class="cm-ph-pct"><b>${me.pct}</b>%<span>match</span></div><div class="cm-ph-verdict">${verdict(me.pct)}</div>`;
        }
        if (me) body += `<div class="cm-ph-gain"><div>#${me.rank} of ${r.count} · <b>+${me.pts.toLocaleString('en-US')}</b>${r.final ? ' <small>(×2)</small>' : ''}</div>${me.perfect ? `<span class="cm-perf">✨ ${r.kind === 'odd' ? 'SPOT ON' : 'PERFECT'}${me.combo > 1 ? ` 🔥×${me.combo}` : ''}</span>` : ''}</div>`;
        paint(el, `${head}<div class="cm-ph-reveal">${body}</div>`, key);
        if (celebrated !== key) {
          celebrated = key;
          if (!me) haptic(ctx, 'tap');
          else if (me.rank === 1 || me.perfect) { haptic(ctx, 'win'); ctx.sfx('cheer'); } else if (me.pct >= 80) haptic(ctx, 'success'); else haptic(ctx, 'buzz');
        }
        return;
      }
      paint(el, `${head}<div class="cm-ph-look"><h2>Next colour coming…</h2></div>`, 'wait');
    },
  };
  const LOOK_KINDS = new Set(['memory', 'blink', 'two']);
})();
