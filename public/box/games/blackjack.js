'use strict';
// Blackjack Night: a late-night card lounge. The TV is the table (neon signs on the wall, the
// dealer behind the felt, every player's seat with cards, bet chips and chip count), the lobby
// is the lounge door (house rules as neon signs, the table settings as chips and cards on the
// felt, the join QR on a membership card). Phones hold your chips, your hand and big moves.
(function () {
  const { esc, card, timer } = BOX;
  const RESULT = { win: ['WIN', 'good'], blackjack: ['BLACKJACK!', 'good'], charlie: ['5-CARD CHARLIE!', 'good'], lucky: ['LUCKY 21!', 'good'], push: ['PUSH', 'meh'], lose: ['LOSE', 'bad'], bust: ['BUST', 'bad'] };
  let pending = 0, pendKey = '', srvBet = 0;
  // Your JustGameBox character (visor, shades, bow tie from the shop) where the emoji was.
  const face = (x, sz = 28, o) => (x && BOX.face ? BOX.face({ ...x, avatar: x.avatar || x.av }, sz, o) : esc((x && (x.av || x.avatar)) || '🙂'));
  const body = (x, h = 96, o) => (x && BOX.body ? BOX.body({ ...x, avatar: x.avatar || x.av }, h, o) : `<span class="bj-emo">${esc((x && (x.av || x.avatar)) || '🙂')}</span>`);
  const av = (x) => (x && (x.av || x.id) ? `<span class="bj-av">${face(x, 28)}</span>` : '');
  const fire = (n) => (n >= 3 ? `<span class="bj-fire" title="${n} wins in a row">🔥${n}</span>` : '');

  // ---------- drawn-in-code art ----------
  // A poker-chip stack for an amount (biggest chips first, at most `max` chips tall).
  const DENOM = [500, 100, 25, 10, 5];
  // JustGold gear: a player's chip set (x.gear.chips → MT_GEAR paint), or null for house chips.
  const chipPaint = (x) => (window.MT_GEAR && x ? MT_GEAR.paint('blackjack', 'chips', x.gear) : null);
  // Inline vars for a gear stack (CSS: .bj-stack.gear in blackjack.css).
  const gearVars = (pt) => (pt ? ` gear${pt.glow ? ' glow' : ''}" style="--g-a:${pt.a || '#e8323c'};--g-b:${pt.b || '#ffffff'}` : '');
  // The 🪙 next to a chip count, or one chip of the player's own set.
  const coin = (x) => { const pt = chipPaint(x); return pt ? `<i class="bj-gchip${pt.glow ? ' glow' : ''}" style="--g-a:${pt.a || '#e8323c'};--g-b:${pt.b || '#ffffff'}"></i>` : '🪙'; };
  function stack(amount, max = 7, pt = null) {
    const out = []; let left = Math.max(0, Math.floor(amount || 0));
    for (const d of DENOM) while (left >= d && out.length < max) { out.push(d); left -= d; }
    if (left > 0 && out.length < max) out.push(5);
    return `<span class="bj-stack${gearVars(pt)}">${out.reverse().map((d, i) => `<i class="bj-c d${d}" style="--i:${i}"></i>`).join('')}</span>`;
  }
  const DEALER = `<svg class="bj-dealer-art" viewBox="0 0 200 172" aria-hidden="true">
    <path d="M14 172 Q18 112 70 98 L130 98 Q182 112 186 172 Z" fill="#f5f1e6" stroke="#1a0b2a" stroke-width="4"/>
    <rect x="20" y="138" width="34" height="12" rx="4" fill="#e8323c" stroke="#1a0b2a" stroke-width="3" transform="rotate(-8 37 144)"/><rect x="146" y="138" width="34" height="12" rx="4" fill="#e8323c" stroke="#1a0b2a" stroke-width="3" transform="rotate(8 163 144)"/>
    <path d="M56 172 L62 106 L100 134 L138 106 L144 172 Z" fill="#1d1d26" stroke="#1a0b2a" stroke-width="4" stroke-linejoin="round"/>
    <path d="M62 106 L100 134 L78 172 L56 172 Z" fill="#2a2a36"/>
    <circle cx="100" cy="148" r="3.5" fill="#ffd166"/><circle cx="100" cy="162" r="3.5" fill="#ffd166"/>
    <path d="M84 100 L100 132 L116 100 Z" fill="#fffdf7" stroke="#1a0b2a" stroke-width="3"/>
    <path d="M100 112 L80 101 L80 123 Z M100 112 L120 101 L120 123 Z" fill="#e8323c" stroke="#1a0b2a" stroke-width="3" stroke-linejoin="round"/><circle cx="100" cy="112" r="5" fill="#b3122e" stroke="#1a0b2a" stroke-width="2.5"/>
    <rect x="88" y="78" width="24" height="24" fill="#e8b48e" stroke="#1a0b2a" stroke-width="3"/>
    <circle cx="66" cy="58" r="8" fill="#e8b48e" stroke="#1a0b2a" stroke-width="3"/><circle cx="134" cy="58" r="8" fill="#e8b48e" stroke="#1a0b2a" stroke-width="3"/>
    <ellipse cx="100" cy="56" rx="34" ry="38" fill="#f0bf98" stroke="#1a0b2a" stroke-width="4"/>
    <path d="M66 48 Q64 14 102 14 Q138 14 134 46 Q124 30 100 28 Q80 28 66 48 Z" fill="#1a1420" stroke="#1a0b2a" stroke-width="3"/>
    <path d="M60 40 Q100 18 140 40 L136 50 Q100 34 64 50 Z" fill="rgba(46,200,130,0.78)" stroke="#0d4a2c" stroke-width="3"/>
    <g class="bj-eyes"><ellipse cx="87" cy="58" rx="4.5" ry="5.5" fill="#1a0b2a"/><ellipse cx="113" cy="58" rx="4.5" ry="5.5" fill="#1a0b2a"/></g>
    <path d="M84 74 Q92 70 100 73 Q108 70 116 74 Q108 77 100 75 Q92 77 84 74 Z" fill="#1a1420"/>
    <path d="M88 80 Q100 88 112 80" fill="none" stroke="#1a0b2a" stroke-width="3" stroke-linecap="round"/>
  </svg>`;
  const SUIT = { S: '♠', H: '♥', D: '♦', C: '♣' };

  // The lounge behind the TV screens: a dark wall with gold pinstripes and art-deco fans,
  // painted once per size; soft bokeh lights drift across it.
  function backdrop(cv) {
    const g = cv.getContext('2d'), TAU = Math.PI * 2;
    let W = 0, H = 0, D = 1, layer = null, bokeh = [], dots = [];
    function sprite(c) {
      const s = document.createElement('canvas'); s.width = s.height = 64; const x = s.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, `rgba(${c}, 0.55)`); gr.addColorStop(0.6, `rgba(${c}, 0.22)`); gr.addColorStop(1, `rgba(${c}, 0)`); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return s;
    }
    function build() {
      const c = document.createElement('canvas'); c.width = W * D; c.height = H * D; const b = c.getContext('2d'); b.scale(D, D);
      const wg = b.createLinearGradient(0, 0, 0, H); wg.addColorStop(0, '#0d0820'); wg.addColorStop(0.6, '#22103a'); wg.addColorStop(1, '#120a1e'); b.fillStyle = wg; b.fillRect(0, 0, W, H);
      b.strokeStyle = 'rgba(212, 167, 60, 0.07)'; b.lineWidth = 2; for (let x = 0; x < W; x += 46) { b.beginPath(); b.moveTo(x, 0); b.lineTo(x, H); b.stroke(); }
      for (const fx of [W * 0.12, W * 0.88]) {
        b.strokeStyle = 'rgba(212, 167, 60, 0.18)'; b.lineWidth = 2;
        for (let r = 1; r <= 5; r++) { b.beginPath(); b.arc(fx, H * 0.62, r * 60, Math.PI, TAU); b.stroke(); }
        for (let i = 1; i < 12; i++) { const a = Math.PI + (i / 12) * Math.PI; b.beginPath(); b.moveTo(fx + Math.cos(a) * 70, H * 0.62 + Math.sin(a) * 70); b.lineTo(fx + Math.cos(a) * 300, H * 0.62 + Math.sin(a) * 300); b.stroke(); }
      }
      const vg = b.createRadialGradient(W / 2, H * 0.55, H * 0.2, W / 2, H * 0.55, W * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)'); b.fillStyle = vg; b.fillRect(0, 0, W, H);
      layer = c;
      if (!bokeh.length) bokeh = ['255, 209, 102', '255, 95, 162', '90, 220, 255'].map(sprite);
      const rnd = (a, z) => a + Math.random() * (z - a);
      dots = Array.from({ length: 18 }, (_, i) => ({ x: rnd(0, W), y: rnd(0, H * 0.7), r: rnd(20, 70), v: rnd(5, 14), ph: rnd(0, TAU), s: i % 3 }));
    }
    function frame(now) {
      if (!cv.isConnected) return;
      requestAnimationFrame(frame);
      const w = window.innerWidth, h = window.innerHeight, d = Math.min(1.5, window.devicePixelRatio || 1);
      if (w !== W || h !== H || d !== D) { W = w; H = h; D = d; cv.width = W * D; cv.height = H * D; build(); }
      const t = now / 1000;
      g.setTransform(D, 0, 0, D, 0, 0); g.drawImage(layer, 0, 0, W, H);
      for (const p of dots) {
        const x = ((p.x + t * p.v) % (W + 140)) - 70, y = p.y + Math.sin(t * 0.4 + p.ph) * 14;
        g.globalAlpha = 0.45 + 0.3 * Math.sin(t * 0.7 + p.ph); g.drawImage(bokeh[p.s], x - p.r, y - p.r, p.r * 2, p.r * 2);
      }
      g.globalAlpha = 1;
    }
    requestAnimationFrame(frame);
  }
  function stageIn(el, cls) {
    let root = el.firstElementChild;
    if (!root || !root.classList.contains('bj-root')) {
      el.innerHTML = '<div class="bj-root"><canvas class="bj-bg"></canvas><div class="bj-stage"></div></div>';
      root = el.firstElementChild; backdrop(root.firstElementChild);
    }
    root.className = 'bj-root ' + (cls || '');
    return root;
  }
  function flash(html, cls) {
    const d = document.createElement('div'); d.className = 'bj-flash ' + (cls || ''); d.innerHTML = `<div class="bj-flash-in">${html}</div>`;
    document.body.appendChild(d); setTimeout(() => d.remove(), 2400);
  }
  // The usual "book" move, as a gentle tip for people who have never played.
  const val = (c) => { const r = c.slice(0, -1); return r === 'A' ? 11 : ['J', 'Q', 'K'].includes(r) ? 10 : Number(r); };
  function tip(v) {
    const h = v.hands[v.active]; if (!h || !v.dealer.cards[0]) return '';
    const up = val(v.dealer.cards[0]), t = h.total;
    if (v.canSplit && ['A', '8'].includes(h.cards[0].slice(0, -1))) return 'Split those! Two chances beat one.';
    if (v.canDouble && (t === 11 || (t === 10 && up < 10))) return 'Great spot to Double!';
    if (h.soft) return t >= 18 ? 'Most players Stand here.' : 'Most players Hit here. An Ace can’t bust you yet.';
    if (t >= 17) return 'Most players Stand on 17 or more.';
    if (t >= 13 && up <= 6) return `Dealer shows ${up}: they may bust. Most players Stand.`;
    if (t === 12 && up >= 4 && up <= 6) return 'Most players Stand and let the dealer bust.';
    return t <= 11 ? 'You can’t bust with one more card. Hit!' : 'Most players Hit here.';
  }

  // ---------- TV lobby: the lounge door ----------
  const NEON = {
    bustBets: ['BUST BETS', '🎯', 'Bet a friend goes over 21', 'pink'],
    events: ['TABLE EVENTS', '🍹', 'Twists + a double-pay finale', 'cyan'],
    showIntro: ['SHOWTIME', '✨', 'The intro cutscene', 'gold'],
  };
  const isBool = (f) => f.type === 'bool' || (f.options.length === 2 && f.options.every((o) => typeof o.value === 'boolean'));
  const hidden = (f, val) => `<select class="bj-hide" data-set="${esc(f.key)}" tabindex="-1" aria-label="${esc(f.label)}">${f.options.map((o) => `<option value="${esc(String(o.value))}" ${String(val) === String(o.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
  function neonSign(f, val, i) {
    const on = val === true || val === 'true', m = NEON[f.key] || [f.label.toUpperCase(), '★', '', ['pink', 'cyan', 'gold'][i % 3]];
    return `<button class="bjl-neon ${m[3]} ${on ? 'on' : 'off'}" data-k="${esc(f.key)}" data-v="${on ? 'false' : 'true'}" style="--d:${i * 0.7}s"><span class="ic">${m[1]}</span><span class="tx"><b>${esc(m[0])}</b><small>${esc(m[2])}</small></span><span class="sw">${on ? 'ON' : 'OFF'}</span>${hidden(f, val)}</button>`;
  }
  function feltSetting(f, val) {
    const opts = f.options, pick = (o) => String(val) === String(o.value);
    if (f.key === 'hands') return `<div class="bjl-set hands"><h4>Hands tonight</h4><div class="bjl-spots">${opts.map((o) => `<button class="bjl-spot ${pick(o) ? 'on' : ''}" data-k="hands" data-v="${esc(String(o.value))}"><span class="ring"></span>${pick(o) ? stack(60, 4) : ''}<b>${esc(String(o.value))}</b></button>`).join('')}</div>${hidden(f, val)}</div>`;
    if (f.key === 'startChips') return `<div class="bjl-set chips"><h4>Starting chips</h4><div class="bjl-stacks">${opts.map((o, i) => `<button class="bjl-pile ${pick(o) ? 'on' : ''}" data-k="startChips" data-v="${esc(String(o.value))}">${stack(o.value, 3 + i * 3)}<b>${esc(String(o.value))}</b></button>`).join('')}</div>${hidden(f, val)}</div>`;
    if (f.key === 'actSeconds') return `<div class="bjl-set secs"><h4>Time per hand</h4><div class="bjl-cards">${opts.map((o, i) => `<button class="bjl-card ${pick(o) ? 'on' : ''} ${i % 2 ? 'red' : ''}" data-k="actSeconds" data-v="${esc(String(o.value))}"><b>${esc(String(o.value))}</b><small>sec</small><i>${i % 2 ? '♥' : '♠'}</i></button>`).join('')}</div>${hidden(f, val)}</div>`;
    return `<div class="bjl-set"><h4>${esc(f.label)}</h4><div class="bjl-spots">${opts.map((o) => `<button class="bjl-spot ${pick(o) ? 'on' : ''}" data-k="${esc(f.key)}" data-v="${esc(String(o.value))}"><span class="ring"></span><b>${esc(o.label)}</b></button>`).join('')}</div>${hidden(f, val)}</div>`;
  }
  let lobbyErr = '';
  function lobbyTv(el, L) {
    const root = stageIn(el, 'bj-in-lobby'), st = root.lastElementChild;
    const n = L.players.length, can = n >= L.min;
    const bools = L.fields.filter(isBool), rest = L.fields.filter((f) => !isBool(f));
    const sz = n > 36 ? 'tiny' : n > 14 ? 'small' : '';
    const html = `<div class="bjl">
      <section class="bjl-wall"><div class="bjl-21">21</div><div class="bjl-open">♦ OPEN ALL NIGHT ♦</div>
        <h3 class="bjl-hh">House rules <small>tap a sign to switch it</small></h3>
        <div class="bjl-signs">${bools.map((f, i) => neonSign(f, L.settings[f.key], i)).join('')}</div>
        <div class="bjl-how"><div>🃏 Get closer to <b>21</b> than the dealer</div><div>👑 Blackjack pays <b>3 to 2</b></div><div>🪙 Most chips after the last hand wins</div></div></section>
      <section class="bjl-table"><div class="bjl-dealer">${DEALER}<div class="bjl-say">Take a seat, high rollers!</div></div>
        <div class="bjl-rail"><div class="bjl-felt">
          <svg class="bj-arc" viewBox="0 0 1000 300" aria-hidden="true"><path id="bjl-arcp" d="M60 40 Q500 330 940 40" fill="none"/><text><textPath href="#bjl-arcp" startOffset="50%" text-anchor="middle">♠ BLACKJACK PAYS 3 TO 2 ♥ DEALER STANDS ON 17 ♣</textPath></text></svg>
          <div class="settings bjl-settings" id="settings">${rest.map((f) => feltSetting(f, L.settings[f.key])).join('')}${bools.map((f) => hidden(f, L.settings[f.key])).join('')}</div>
          <div class="bjl-seated"><div class="bjl-st">${n ? `<b>${n}</b> ${n === 1 ? 'player' : 'players'} at the table` : 'Empty seats, waiting for players…'}</div>
            <div class="roster bjl-roster ${sz}" id="roster">${L.players.map((p, i) => `<span class="chip bjl-p ${p.online === false ? 'off' : ''} ${L.vip && p.name === L.vip ? 'vip' : ''}" id="bjp-${esc(p.id)}" data-kick="${esc(p.id)}" style="--c:${esc(p.color || '#e8323c')};--d:${(i % 6) * 0.2}s" title="Click to remove"><span class="tok"><span class="av">${face(p, sz === 'tiny' ? 34 : sz === 'small' ? 48 : 62)}</span></span><span class="nm">${esc(p.name)}</span></span>`).join('')}</div></div>
        </div></div></section>
      <aside class="bjl-side">
        <div class="bjl-member"><div class="bjl-mtop"><small>Members only</small><span class="bjl-script">Blackjack Night</span></div>
          <div class="bjl-qr"><img id="qr" src="${esc(L.qr)}" alt="QR code to join"></div>
          <div class="bjl-scan">Scan to take a seat</div>
          <div class="bjl-codebox"><small>Room code</small><div class="bjl-code" id="code">${esc(L.code)}</div></div>
          <div class="bjl-url">${esc(L.joinUrl.replace(/^https?:\/\//, '').replace(/\?.*$/, ''))}</div>
          <div class="bjl-chipdeco"></div></div>
        <div class="bjl-vip">${L.vip ? `👑 <b>${esc(L.vip)}</b> is the host and can deal from their phone` : 'The first player in becomes the host 👑'}</div>
        <button class="bjl-start" id="start" ${can ? '' : 'disabled'}><span>🃏</span> Open the table</button>
        <div class="err bjl-err" id="lobby-err">${esc(lobbyErr)}</div>
        <div class="bjl-links"><button class="link" id="add-bots">+ seat 5 bots</button><button class="link" id="rm-bots">remove bots</button><button class="link" id="bjl-pick">🎮 Another game</button><a class="link" href="?game=blackjack&new=1">New room</a></div>
      </aside></div>`;
    BOX.morph(st, html);
    for (const s of st.querySelectorAll('[data-set]')) { s.onchange = () => L.set(s.dataset.set, s.value); s.onclick = (e) => e.stopPropagation(); }
    for (const b of st.querySelectorAll('[data-k]')) b.onclick = () => { L.set(b.dataset.k, b.dataset.v); BOX.sfx(b.classList.contains('bjl-neon') ? 'zap' : 'ballot'); };
    for (const c of st.querySelectorAll('[data-kick]')) c.onclick = () => { if (confirm('Remove this player?')) L.kick(c.dataset.kick); };
    st.querySelector('#start').onclick = async () => { const r = await L.start(); lobbyErr = r && r.ok ? '' : (r && r.error) || ''; const e = st.querySelector('#lobby-err'); if (e) e.textContent = lobbyErr; };
    st.querySelector('#add-bots').onclick = () => L.bots(5);
    st.querySelector('#rm-bots').onclick = () => L.removeBots();
    st.querySelector('#bjl-pick').onclick = () => L.pick();
  }

  // ---------- TV game ----------
  function seatStatus(x, phase) {
    if (phase === 'results' && x.net != null && x.hands.length) return `<span class="bj-net ${x.net > 0 ? 'good' : x.net < 0 ? 'bad' : 'meh'}">${x.net > 0 ? '+' + x.net : x.net < 0 ? x.net : 'PUSH'}</span>`;
    if (x.hands.some((h) => h.total > 21)) return '<span class="bj-net bad">BUST</span>';
    if (x.hands.some((h) => h.bj)) return '<span class="bj-net good">BLACKJACK</span>';
    if (x.hands.some((h) => h.charlie)) return '<span class="bj-net good">🖐️ CHARLIE</span>';
    return '';
  }
  function seat(x, size, phase, pos) {
    const res = x.hands.map((h) => h.result).filter(Boolean);
    const lost = res.length && res.every((r) => r === 'bust' || r === 'lose');
    const cls = [size, lost ? 'lost' : '', phase === 'results' && x.net > 0 ? 'won' : '', x.acting ? 'acting' : '', phase === 'betting' && x.bet ? 'in' : '', !x.hands.length && phase !== 'betting' ? 'out' : '', /left:(5\d|[6-9]\d)\./.test(pos || '') ? 'rside' : ''].join(' ');
    const st = seatStatus(x, phase);
    const bet = x.bet || x.hands.reduce((a, h) => a + (h.bet || 0), 0);
    if (size === 'lg') {
      const hands = x.hands.map((h, i) => `<div class="bj-hand"><div class="cards fan" id="bh-${esc(x.id)}-${i}-${h.cards.length}">${h.cards.map((c) => card(c, { size: 'sm' })).join('')}</div><span class="bj-tot ${h.total > 21 ? 'bust' : h.total === 21 ? 'bj' : ''}">${h.total}</span></div>`).join('');
      return `<div class="bj-seat lg ${cls}" id="bs-${esc(x.id)}" style="${pos};--c:${esc(x.color || '#e8323c')}">
        <div class="bj-hands">${hands || (phase === 'betting' ? '' : '<span class="bj-sit">sitting out</span>')}</div>
        <div class="bj-bspot ${bet ? 'has' : ''}">${bet ? stack(bet, 6, chipPaint(x)) : ''}${bet ? `<b class="bj-amt">${bet}</b>` : ''}</div>
        <div class="bj-plate"><span class="bj-who">${body(x, 104, { mood: lost ? 'sad' : phase === 'results' && x.net > 0 ? 'grin' : undefined })}</span><span class="nm">${esc(x.name)}</span>${fire(x.streak)}${x.targeted ? `<span class="bj-tg" title="Bust Bets on this player">🎯${x.targeted}</span>` : ''}</div>
        <div class="bj-chips">${coin(x)} ${x.chips}</div>${st}</div>`;
    }
    const hands = size === 'xs' || size === 'sm' ? x.hands.map((h) => `<span class="bj-tot">${h.total}</span>`).join(' ')
      : x.hands.map((h, i) => `<div class="bj-hand"><div class="cards fan" id="bh-${esc(x.id)}-${i}-${h.cards.length}">${h.cards.map((c) => card(c, { size: 'xs' })).join('')}</div><span class="bj-tot">${h.total}</span></div>`).join('');
    const status = st || (x.bet && phase === 'betting' ? `<span class="bj-bet">🪙 ${x.bet}</span>` : '');
    return `<div class="bj-seat ${cls}" id="bs-${esc(x.id)}"><div class="bj-name"><i style="background:${esc(x.color)}"></i>${av(x)}<span class="nm">${esc(x.name)}</span>${fire(x.streak)}${x.targeted ? ` <span class="bj-tg">🎯${x.targeted}</span>` : ''}</div>
      <div class="bj-row">${hands || (phase === 'betting' ? '' : '<span class="muted">sitting out</span>')}${status}</div><div class="bj-chips">${coin(x)} ${x.chips}</div></div>`;
  }
  function message(s) {
    if (s.phase === 'betting') return `<div class="bj-big1">Place your bets!</div><div class="bj-sub">${timer(s.endsIn)}</div>`;
    if (s.phase === 'playing') return `<div class="bj-big1">Hit or stand?</div><div class="bj-sub">${timer(s.endsIn)}</div>`;
    if (s.phase === 'dealer') return '<div class="bj-big1">The dealer plays…</div>';
    const L = s.last; if (!L) return '';
    if (L.note) return `<div class="bj-big1">${esc(L.note)}</div>`;
    const head = L.dealerBJ ? 'Dealer blackjack! 😱' : L.dealer === 'bust' ? 'The dealer BUSTS! 🎉' : `Dealer stands on ${L.dealer}`;
    const lines = [];
    if (L.best) lines.push(`💰 <b>${esc(L.best.name)}</b> won +${L.best.net}`);
    if (L.bjs && L.bjs.length) lines.push(`🃏 Blackjack: ${L.bjs.map(esc).join(', ')}`);
    if (L.charlies && L.charlies.length) lines.push(`🖐️ Charlie: ${L.charlies.map(esc).join(', ')}`);
    if (L.bustWins && L.bustWins.length) lines.push(`🎯 Bust Bets paid: ${L.bustWins.slice(0, 5).map(esc).join(', ')}${L.bustWins.length > 5 ? '…' : ''}`);
    if (L.hot && L.hot.length) lines.push(`🔥 On fire: ${L.hot.map((h) => esc(h.name) + ' ×' + h.streak).join(', ')}`);
    return `<div class="bj-big1 ${L.dealer === 'bust' ? 'good' : ''}">${head}</div><div class="bj-sub">${L.winners} won · ${L.losers} lost</div>${lines.length ? `<div class="bj-news">${lines.slice(0, 3).map((l) => `<div>${l}</div>`).join('')}</div>` : ''}`;
  }
  function waiting(s) {
    if (!s.waitingCount || (s.phase !== 'betting' && s.phase !== 'playing')) return '';
    return `<div class="bj-wait">⏳ Waiting on ${s.waitingOn.slice(0, 5).map((n) => `<b>${esc(n)}</b>`).join(', ')}${s.waitingCount > Math.min(5, s.waitingOn.length) ? ` +${s.waitingCount - Math.min(5, s.waitingOn.length)} more` : ''}</div>`;
  }
  const eventBadge = (e, big) => (e ? `<div class="bj-event ${e.key} ${big ? 'big' : ''}"><span class="ic">${e.icon}</span><div><b>${esc(e.name)}</b><small>${esc(e.text)}</small></div></div>` : '');
  function finale(s) {
    const st = s.top, w = st[0];
    const step = (x, p) => (x ? `<div class="pd p${p}"><div class="who bj-podfig">${body(x, p === 1 ? 170 : 136, { mood: p === 1 ? 'grin' : undefined })}</div><div class="nm">${esc(x.name)}</div><div class="blk">${stack(x.chips, p === 1 ? 9 : p === 2 ? 7 : 5)}<b>${p}</b><small>${x.chips} chips</small></div></div>` : '<div class="pd"></div>');
    return `<div class="bj-over"><div class="bj-hr"><small>High roller of the night</small><h1>${w ? esc(w.name) : 'Nobody'}</h1><span>${w ? w.chips + ' chips' : ''}</span></div>
      <div class="bj-podium">${step(st[1], 2)}${step(st[0], 1)}${step(st[2], 3)}</div>
      ${(s.awards || []).length ? `<div class="bj-awards">${s.awards.map((a, i) => `<div class="bj-award" style="--i:${i}"><div class="ic">${a.icon}</div><b>${esc(a.title)}</b><div class="who2">${a.id ? face(a, 30) + ' ' : ''}${esc(a.name)}</div><small>${esc(a.why)}</small></div>`).join('')}</div>` : ''}
      ${st.length > 3 ? `<div class="bj-rest">${st.slice(3, 10).map((x, i) => `<div class="row"><span class="n">${i + 4}</span><span>${face(x, 30)} ${esc(x.name)}</span><b>${x.chips} 🪙</b></div>`).join('')}</div>` : ''}</div>`;
  }

  // ---------- phone haptics: compare with the last view this phone drew ----------
  let prev = null;
  function feel(v, ctx) {
    const h = (k) => ctx.haptic(k), p = prev || {};
    const my = v.hands || [];
    const cur = { phase: v.phase, round: v.round, turn: v.phase === 'playing' && v.active >= 0, bust: my.some((x) => x.total > 21), bj: my.some((x) => x.bj), ev: v.event ? v.event.key : '' };
    if (prev) {
      if (cur.phase === 'over' && p.phase !== 'over') h(v.rank === 1 ? 'win' : 'success');
      if (cur.phase === 'results' && p.phase !== 'results') h(v.net > 0 ? (my.some((x) => x.result === 'blackjack') || v.net >= 200 ? 'win' : 'success') : v.net < 0 ? 'warn' : 'tap');
      if (cur.phase === 'results' && p.phase !== 'results' && v.bustWon) setTimeout(() => h('success'), 600);
      if (cur.turn && !p.turn) h('turn');
      if (cur.round === p.round && cur.bust && !p.bust) h('error');
      if (cur.round === p.round && cur.bj && !p.bj) h('win');
      if (cur.ev && cur.ev !== p.ev) h(cur.ev === 'finale' ? 'big' : 'select');
    }
    prev = cur;
  }

  BOX.games.blackjack = {
    // Soundtrack cue per phase (public/box/scores/<key>.js); the TV turns the last 10 s of 'think' tense.
    music: (s) => ({ betting: 'think', playing: 'play', dealer: 'tense', results: 'reveal', over: 'finale' }[s.phase] || 'play'),
    name: 'Blackjack Night', icon: '🃏',
    about: 'Everyone plays against the dealer at the same time. Most chips after the last hand wins.',
    how: [
      'Place your bet on your phone before the timer runs out.',
      'Get closer to 21 than the dealer without going over. Face cards are 10, Aces are 1 or 11.',
      'Hit for another card, Stand to stop, Double to double your bet for one last card, Split a pair into two hands.',
      'Blackjack (an Ace and a 10-card) pays 3 to 2. The dealer draws to 17.',
      'Twists! Some hands are Happy Hour, Five-Card Charlie, Ties Win or Lucky 21, and the last hand pays DOUBLE.',
      'Bust Bets: pay 25 chips to bet a friend goes bust. If they do, you get 75! Out of chips? Free comeback chips.',
    ],
    fx: { deal: 'deal', flip: 'flip', bust: 'boo', dealerBust: 'cheer', dealerBJ: 'sting', settle: 'chime', chip: 'ballot', allin: 'drum', double: 'pop', shuffle: 'shuffle', win: 'win', event: 'bell', charlie: 'cheer', bjWin: 'swell' },
    onFx(f) {
      if (f.kind === 'event') {
        const e = { happy: ['🍹', 'HAPPY HOUR', 'Blackjack pays 2 to 1!'], charlie: ['🖐️', 'FIVE-CARD CHARLIE', '5 cards without busting wins!'], ties: ['🤝', 'TIES WIN', 'Tie the dealer, get paid!'], lucky21: ['🍀', 'LUCKY 21', 'A 21 with 3+ cards pays 2 to 1!'], finale: ['🏁', 'HIGH ROLLER FINALE', 'Last hand: every win pays DOUBLE!'] }[f.ev];
        if (e) flash(`<div class="ic">${e[0]}</div><div class="big">${e[1]}</div><div>${e[2]}</div>`, f.ev);
      } else if (f.kind === 'allin') flash(`<div class="big">ALL IN!</div><div>${esc(f.name || '')} bets everything</div>`, 'allin');
      else if (f.kind === 'dealerBust') flash('<div class="big">DEALER BUSTS!</div><div>Everyone still standing gets paid</div>', 'good');
      else if (f.kind === 'dealerBJ') flash('<div class="big">DEALER BLACKJACK</div>', 'bad');
    },
    lobbyTv,

    tv(el, s) {
      if (!s) return;
      const root = stageIn(el, 'bj-in-game'), stg = root.lastElementChild;
      if (s.phase === 'over') { BOX.morph(stg, finale(s)); return; }
      const n = s.seats.length, size = n <= 8 ? 'lg' : n <= 18 ? 'md' : n <= 40 ? 'sm' : 'xs';
      const d = s.dealer;
      const seats = s.seats.slice().sort((a, b) => a.rank - b.rank);
      // Big table: seats sit around the curved edge of the felt, left to right.
      const pos = (i) => { if (size !== 'lg') return ''; const a = (n === 1 ? 90 : 158 - (i * 136) / (n - 1)) * Math.PI / 180; return `left:${(50 + Math.cos(a) * 41).toFixed(2)}%;top:${(14 + Math.sin(a) * 62).toFixed(2)}%`; };
      const dtot = d.cards.length ? (d.hidden ? 'Shows ' + d.total : d.total > 21 ? d.total + ' · BUST' : d.total) : '';
      BOX.morph(stg, `<div class="bj-tv ${s.phase}">
        <div class="bj-top">
          <div class="bj-msg">${eventBadge(s.event, true)}${message(s)}${waiting(s)}</div>
          <div class="bj-dealer ${s.phase === 'dealer' ? 'live' : ''}">${DEALER}<div class="bj-hand-no">Hand ${s.round} of ${s.totalHands}</div></div>
          <aside class="bj-side"><h3>Chip leaders</h3>${s.top.slice(0, 6).map((r, i) => `<div class="bj-lrow ${i === 0 ? 'first' : ''}"><span class="n">${i + 1}</span>${av(r)}<span class="nm">${esc(r.name)}</span>${fire(r.streak)}<b>${r.chips}</b></div>`).join('')}</aside>
        </div>
        <div class="bj-table"><div class="bj-felt">
          <div class="bj-rack">${[500, 100, 25, 10, 5].map((dd) => `<span class="bj-tube">${Array.from({ length: 5 }, () => `<i class="bj-c d${dd}"></i>`).join('')}</span>`).join('')}</div>
          <div class="bj-dcards"><div class="cards" id="dl-${s.round}-${d.hidden ? 'h' : 'o'}">${d.cards.map((c) => card(c, { size: 'lg' })).join('')}</div>${dtot ? `<div class="bj-dtot ${d.total > 21 && !d.hidden ? 'bust' : ''}">${dtot}</div>` : ''}</div>
          <div class="bj-print l">♠ BLACKJACK PAYS 3 TO 2 ♥</div><div class="bj-print r">♦ DEALER STANDS ON 17 ♣</div>
          <div class="bj-seats ${size}">${seats.map((x, i) => seat(x, size, s.phase, pos(i))).join('')}</div>
        </div></div></div>`);
    },

    // Shown under "You're in!" on the phone in the lobby.
    lobby() {
      return `<div class="bj-lobby-ph"><div class="bj-mini-member"><small>Members only</small><b>Blackjack Night</b><span>Your seat is saved. Chips are on the house!</span></div>
        <div class="bj-mini-how"><div><i class="bj-c d25"></i><span>Bet chips</span></div><div><span class="ic">👆</span><span>Hit or stand</span></div><div><span class="ic">🎯</span><span>Beat the dealer to 21</span></div></div></div>`;
    },

    phone(el, v, ctx) {
      if (!v) return;
      feel(v, ctx);
      if (v.phase === 'over') {
        const me = (v.awards || []).map((a) => `<div class="bj-myaward"><span>${a.icon}</span><div><b>${esc(a.title)}</b><small>${esc(a.why)}</small></div></div>`).join('');
        BOX.morph(el, `<div class="bj-ph"><div class="card-box bj-endbox ${v.rank === 1 ? 'champ' : ''}"><div class="bj-neonline">${v.rank === 1 ? 'HIGH ROLLER' : 'LAST CALL'}</div><div class="bj-endrank">#${v.rank}</div><h3>${v.rank === 1 ? 'High roller of the night!' : 'Last hand played!'}</h3>${stack(v.chips, 8)}<p>${v.chips} chips · of ${v.of} players</p>${me}</div><div class="card-box">${BOX.board(v.final, (r) => r.chips, ' 🪙')}</div></div>`);
        return;
      }
      const head = `<div class="bj-me"><div class="bj-bank">${stack(v.chips, 6, chipPaint(v))}<span class="bj-big">${v.chips}</span><small>chips</small></div>${fire(v.streak)}<div class="bj-meinfo"><b>Hand ${v.round}/${v.totalHands}</b><span>#${v.rank} of ${v.of}${v.leader && v.rank !== 1 ? ' · leader ' + esc(v.leader.name) + ' ' + v.leader.chips : v.rank === 1 ? ' · you lead!' : ''}</span></div></div>`;
      const ev = v.event ? `<div class="bj-event ph ${v.event.key}"><span class="ic">${v.event.icon}</span><div><b>${esc(v.event.name)}</b><small>${esc(v.event.text)}</small></div></div>` : '';
      if (v.phase === 'betting') {
        const k = 'b' + v.round;
        if (pendKey !== k) { pendKey = k; pending = v.bet || 0; srvBet = v.bet; }
        if (v.bet !== srvBet) { srvBet = v.bet; if (v.bet) pending = v.bet; }
        pending = Math.min(pending, v.chips);
        const chips = [10, 25, 100, 500].filter((c) => c <= v.chips);
        const same = v.lastBet && v.lastBet <= v.chips && !v.bet ? `<button class="btn bj-same" id="bj-same">↻ Same bet · ${v.lastBet}</button>` : '';
        const placed = v.bet && v.bet === pending;
        BOX.morph(el, `<div class="bj-ph">${head}${ev}${v.rebuys && v.round > 1 && v.chips <= v.comeback ? `<p class="bj-note">🎁 Comeback chips! The house spotted you ${v.comeback}.</p>` : ''}
          <div class="card-box bj-betbox ${placed ? 'placed' : ''}"><h3>Place your bet <span class="bj-time">${timer(v.endsIn)}</span></h3>
          <div class="bj-circle ${pending ? 'has' : ''}"><span class="ring"></span>${pending ? stack(pending, 9, chipPaint(v)) : ''}<div class="bj-pending">${pending ? pending : '<span class="muted">Tap chips to bet</span>'}</div></div>
          ${same}
          <div class="bj-chipbtns">${chips.map((c) => `<button class="chipbtn c${c}" data-add="${c}"><span>${c}</span></button>`).join('')}</div>
          <div class="pr-btns bj-quick"><button class="btn ghost small" id="bj-clear">Clear</button><button class="btn ghost small" id="bj-half">Half</button><button class="btn ghost small" id="bj-all">All in</button></div>
          <button class="btn big bj-go" id="bj-bet" ${pending >= v.minBet && !placed ? '' : 'disabled'}>${placed ? 'Bet placed ✓' : 'Bet ' + (pending || '')}</button></div>
          ${v.bustBets && v.others.length ? `<div class="card-box bj-bustbox"><h3>🎯 Bust Bet <span>${v.bustStake} chips · pays ${v.bustPays}</span></h3><p>Who will go over 21 this hand?</p>
          <div class="bj-bustlist"><button class="bj-bustbtn ${v.bust ? '' : 'sel'}" data-bust="">Nobody</button>${v.others.map((o) => `<button class="bj-bustbtn ${v.bust === o.id ? 'sel' : ''}" data-bust="${esc(o.id)}">${BOX.face ? BOX.face(o, 26) + ' ' : ''}${esc(o.name)}</button>`).join('')}</div></div>` : ''}</div>`);
        for (const b of el.querySelectorAll('[data-add]')) b.onclick = () => { pending = Math.min(v.chips, pending + Number(b.dataset.add)); if (v.bet && pending !== v.bet) ctx.act({ op: 'bet', amount: 0 }); ctx.sfx('ballot'); ctx.haptic('select'); ctx.redraw(); };
        el.querySelector('#bj-clear').onclick = () => { pending = 0; if (v.bet) ctx.act({ op: 'bet', amount: 0 }); ctx.redraw(); };
        el.querySelector('#bj-half').onclick = () => { pending = Math.max(v.minBet, Math.floor(v.chips / 2)); if (v.bet) ctx.act({ op: 'bet', amount: 0 }); ctx.redraw(); };
        el.querySelector('#bj-all').onclick = () => { pending = v.chips; if (v.bet) ctx.act({ op: 'bet', amount: 0 }); ctx.haptic('warn'); ctx.redraw(); };
        el.querySelector('#bj-bet').onclick = async () => { const r = await ctx.act({ op: 'bet', amount: pending }); if (r.ok) { ctx.sfx('ballot'); ctx.haptic(pending >= v.chips && pending >= 100 ? 'big' : 'success'); } };
        const sm = el.querySelector('#bj-same'); if (sm) sm.onclick = async () => { pending = v.lastBet; const r = await ctx.act({ op: 'bet', amount: v.lastBet }); if (r.ok) { ctx.sfx('ballot'); ctx.haptic('success'); } };
        for (const b of el.querySelectorAll('[data-bust]')) b.onclick = () => { ctx.act({ op: 'bust', on: b.dataset.bust || null }); ctx.sfx('click'); ctx.haptic('select'); };
        return;
      }
      pendKey = '';
      const dealer = `<div class="bj-dsmall"><div class="bj-dface">${DEALER}</div><div class="cards">${v.dealer.cards.map((c) => card(c, { size: 'sm' })).join('')}</div><b>${v.dealer.cards.length ? (v.dealer.hidden ? 'shows ' + v.dealer.total : v.dealer.total > 21 ? 'BUST' : v.dealer.total) : ''}</b></div>`;
      if (!v.hands.length) { BOX.morph(el, `<div class="bj-ph">${head}${ev}${dealer}<div class="card-box bj-sitout"><p>You’re sitting this hand out. Bet next hand!</p></div></div>`); return; }
      const hands = v.hands.map((h, i) => `<div class="card-box bj-myhand ${i === v.active && v.phase === 'playing' ? 'active' : ''} ${h.total > 21 ? 'busted' : ''}"><div class="cards" id="mh-${v.round}-${i}-${h.cards.length}">${h.cards.map((c) => card(c)).join('')}</div>
        <div class="bj-myinfo"><b class="bj-total ${h.total > 21 ? 'bust' : h.total === 21 ? 'bj' : ''}">${h.total}${h.soft ? ' <small>soft</small>' : ''}</b> <span class="bj-betinfo">${stack(h.bet, 4, chipPaint(v))} bet ${h.bet}${h.doubled ? ' (doubled)' : ''}</span> ${h.result ? `<span class="bj-net ${RESULT[h.result][1]}">${RESULT[h.result][0]}</span>` : h.total > 21 ? '<span class="bj-net bad">BUST</span>' : h.bj ? '<span class="bj-net good">BLACKJACK!</span>' : h.charlie ? '<span class="bj-net good">5-CARD CHARLIE!</span>' : ''}</div></div>`).join('');
      let btns = '';
      if (v.phase === 'playing' && v.active >= 0) {
        btns = `<div class="bj-turn"><span>Your move</span> ${timer(v.endsIn)}${v.hands.length > 1 ? ` · hand ${v.active + 1}` : ''}</div><div class="bj-moves"><button class="btn big bj-hit" data-op="hit"><i>👆</i>Hit</button><button class="btn big bj-stand" data-op="stand"><i>✋</i>Stand</button>${v.canDouble ? '<button class="btn big bj-dbl" data-op="double"><i>×2</i>Double</button>' : ''}${v.canSplit ? '<button class="btn big bj-split" data-op="split"><i>✂</i>Split</button>' : ''}</div><p class="bj-tip"><span>💡</span>${esc(tip(v))}</p>`;
      } else if (v.phase === 'playing') btns = '<div class="big-status bj-wait-ph">Waiting for the others…</div>';
      else if (v.phase === 'dealer') btns = '<div class="big-status bj-wait-ph">The dealer plays… 👀</div>';
      else if (v.phase === 'results') btns = `<div class="big-status bj-res ${v.net > 0 ? 'good' : v.net < 0 ? 'bad' : ''}">${v.net > 0 ? 'You won ' + v.net + '! 🎉' : v.net < 0 ? 'You lost ' + -v.net : 'Push. Your chips are back.'}</div>${v.bustWon != null ? `<p class="bj-bustres">🎯 ${v.bustWon ? 'Your Bust Bet on ' + esc(v.bustName) + ' paid ' + v.bustPays + '!' : 'Your Bust Bet on ' + esc(v.bustName) + ' missed.'}</p>` : ''}`;
      BOX.morph(el, `<div class="bj-ph">${head}${ev}${dealer}${hands}${btns}</div>`);
      for (const b of el.querySelectorAll('[data-op]')) b.onclick = () => { ctx.act({ op: b.dataset.op }); ctx.sfx('deal'); };
    },
  };
})();
