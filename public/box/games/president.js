'use strict';
// President: a velvet throne room. The TV shows the court (the lobby, where the house rules
// are a royal decree sealed in wax), the royal card table(s) with the pile and every seat, the
// proclamation between rounds and the coronation at the end. Phones hold your title medallion,
// the cards to beat and your hand with one-tap legal plays.
(function () {
  const { esc, card, timer } = BOX;
  const TITLE_ICON = { president: '👑', vp: '🎩', citizen: '🙂', vscum: '🧽', scum: '🧹' };
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const SUITS = ['♠', '♥', '♦', '♣'];
  const rankOf = (c) => c.slice(0, -1);
  const POW = (c) => (RANKS.indexOf(rankOf(c)) + 11) % 13;
  const EFF = (c, rev) => (rev ? 12 - POW(c) : POW(c));
  const badge = (t, names) => (t ? `<span class="pr-title t-${t}">${TITLE_ICON[t]} ${esc(names[t])}</span>` : '');
  // JustGold gear: a seat's card back (x.gear.cardBack → MT_GEAR paint). '' keeps the red velvet back.
  const backPaint = (x) => (window.MT_GEAR && x ? MT_GEAR.paint('president', 'cardBack', x.gear) : null);
  function backStyle(x) {
    const p = backPaint(x); if (!p) return '';
    const a = p.a || '#a3132f', b = p.b || '#ffe7a0';
    const bg = { stripes: `repeating-linear-gradient(45deg, ${b} 0 2px, ${a} 2px 6px)`, check: `repeating-linear-gradient(45deg, ${b}99 0 1.5px, transparent 1.5px 5px), repeating-linear-gradient(-45deg, ${b}99 0 1.5px, transparent 1.5px 5px), ${a}`,
      dots: `radial-gradient(circle, ${b} 22%, transparent 26%) 0 0 / 6px 6px, ${a}`, stars: `radial-gradient(circle, ${b} 12%, transparent 16%) 1px 2px / 7px 8px, radial-gradient(circle, ${b}aa 8%, transparent 12%) 4px 6px / 9px 9px, ${a}`,
      wave: `repeating-radial-gradient(circle at 50% 130%, ${a} 0 3px, ${b} 3px 4.5px, ${a} 4.5px 7px)` }[p.pattern] || `linear-gradient(160deg, ${a}, ${b})`;
    return `background:${bg};border-color:${b};${p.glow ? `box-shadow:0 0 6px ${b};` : ''}`;
  }
  const av = (x) => (x && x.av ? `<span class="pr-av">${esc(x.av)}</span>` : '');
  const tname = (id, n) => (id === 0 && n > 1 ? '👑 The Palace' : 'Table ' + (id + 1));
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const setName = (n) => ['', 'single', 'pair', 'triple', 'four of a kind'][n] || n + ' cards';
  const hashOf = (s) => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.codePointAt(0)) >>> 0; return h; };
  let selected = new Set();
  let selKey = '';

  // ---------- drawn-in-code art ----------
  const CROWN = (cls = '') => `<svg class="pr-crown ${cls}" viewBox="0 0 100 74" aria-hidden="true"><path d="M10 62 L4 18 L29 40 L50 6 L71 40 L96 18 L90 62 Z" fill="#ffc93a" stroke="#6b3a05" stroke-width="4" stroke-linejoin="round"/><path d="M14 56 L10 28 L29 46 L50 16 L50 56 Z" fill="#fff2a8" opacity=".45"/><rect x="7" y="54" width="86" height="14" rx="4" fill="#e6a51f" stroke="#6b3a05" stroke-width="4"/><circle cx="50" cy="61" r="5" fill="#e0233f"/><circle cx="27" cy="61" r="4" fill="#2f6bff"/><circle cx="73" cy="61" r="4" fill="#2f6bff"/><circle cx="4" cy="18" r="5" fill="#fff6c8" stroke="#6b3a05" stroke-width="3"/><circle cx="50" cy="6" r="5" fill="#fff6c8" stroke="#6b3a05" stroke-width="3"/><circle cx="96" cy="18" r="5" fill="#fff6c8" stroke="#6b3a05" stroke-width="3"/></svg>`;
  function throneSvg(cls = '') {
    let dia = '';
    for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) { const x = 74 + c * 24 + (r % 2) * 12, y = 70 + r * 24; if (x < 150) dia += `<path d="M${x} ${y - 7} L${x + 5} ${y} L${x} ${y + 7} L${x - 5} ${y} Z"/>`; }
    return `<svg class="pr-throne ${cls}" viewBox="0 0 220 262" aria-hidden="true">
      <path d="M38 252 V92 Q38 22 110 8 Q182 22 182 92 V252 Z" fill="#e8b43a" stroke="#6b3a05" stroke-width="5"/>
      <path d="M46 240 V96 Q46 34 110 20" fill="none" stroke="#fff2a8" stroke-width="4" opacity=".55"/>
      <path d="M58 202 V98 Q58 42 110 32 Q162 42 162 98 V202 Z" fill="#a3132f" stroke="#5c0619" stroke-width="4"/>
      <g fill="#ffd86a" opacity=".3">${dia}</g>
      <g transform="translate(78 -8) scale(.64)"><path d="M10 62 L4 18 L29 40 L50 6 L71 40 L96 18 L90 62 Z" fill="#ffc93a" stroke="#6b3a05" stroke-width="5" stroke-linejoin="round"/><circle cx="50" cy="6" r="6" fill="#fff6c8" stroke="#6b3a05" stroke-width="3"/></g>
      <circle cx="110" cy="62" r="9" fill="#e0233f" stroke="#6b3a05" stroke-width="3"/>
      <rect x="14" y="166" width="50" height="24" rx="11" fill="#e8b43a" stroke="#6b3a05" stroke-width="4"/>
      <rect x="156" y="166" width="50" height="24" rx="11" fill="#e8b43a" stroke="#6b3a05" stroke-width="4"/>
      <circle cx="20" cy="178" r="7" fill="#fff2a8" stroke="#6b3a05" stroke-width="3"/><circle cx="200" cy="178" r="7" fill="#fff2a8" stroke="#6b3a05" stroke-width="3"/>
      <path d="M44 192 H176 Q188 194 184 210 L180 224 H40 L36 210 Q32 194 44 192 Z" fill="#c11a3a" stroke="#5c0619" stroke-width="4"/>
      <path d="M52 198 H168" stroke="#ff7a8e" stroke-width="4" stroke-linecap="round" opacity=".6"/>
      <rect x="30" y="222" width="160" height="26" rx="7" fill="#e8b43a" stroke="#6b3a05" stroke-width="4"/>
      <circle cx="110" cy="235" r="6" fill="#2f6bff" stroke="#6b3a05" stroke-width="2"/><circle cx="70" cy="235" r="4" fill="#e0233f"/><circle cx="150" cy="235" r="4" fill="#e0233f"/>
      <rect x="36" y="246" width="20" height="14" rx="3" fill="#b98316" stroke="#6b3a05" stroke-width="3"/><rect x="164" y="246" width="20" height="14" rx="3" fill="#b98316" stroke="#6b3a05" stroke-width="3"/>
    </svg>`;
  }
  const WAX = (glyph, cls = '') => `<span class="pr-wax ${cls}"><i>${glyph}</i></span>`;

  // The throne room behind the TV screens: velvet, damask, curtains and a marble floor,
  // painted once per size; only the glitter and the slow sunburst move.
  function backdrop(cv) {
    const st = { rev: false, lobby: false };
    const g = cv.getContext('2d');
    let W = 0, H = 0, D = 1, layer = null, glit = [];
    const TAU = Math.PI * 2;
    function build() {
      const c = document.createElement('canvas'); c.width = W * D; c.height = H * D;
      const b = c.getContext('2d'); b.scale(D, D);
      const rg = b.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, Math.max(W, H) * 0.75);
      rg.addColorStop(0, '#5a1870'); rg.addColorStop(0.5, '#2c0a3a'); rg.addColorStop(1, '#110317'); b.fillStyle = rg; b.fillRect(0, 0, W, H);
      b.fillStyle = 'rgba(255, 210, 90, 0.06)';
      for (let y = 40, r = 0; y < H * 0.9; y += 86, r++) for (let x = (r % 2) * 40; x < W + 80; x += 80) {
        b.beginPath(); b.moveTo(x, y - 13); b.lineTo(x + 8, y); b.lineTo(x, y + 13); b.lineTo(x - 8, y); b.closePath(); b.fill();
        b.beginPath(); b.arc(x, y - 19, 3, 0, TAU); b.fill(); b.beginPath(); b.arc(x, y + 19, 3, 0, TAU); b.fill();
      }
      for (const px of [W * 0.16, W * 0.84]) { const lg = b.createLinearGradient(px - 160, 0, px + 160, 0); lg.addColorStop(0, 'rgba(255,200,90,0)'); lg.addColorStop(0.5, 'rgba(255,200,90,0.06)'); lg.addColorStop(1, 'rgba(255,200,90,0)'); b.fillStyle = lg; b.fillRect(px - 160, 0, 320, H); }
      const yF = H * 0.9;
      const fg = b.createLinearGradient(0, yF, 0, H); fg.addColorStop(0, '#3a1028'); fg.addColorStop(1, '#14040d'); b.fillStyle = fg; b.fillRect(0, yF, W, H - yF);
      b.strokeStyle = 'rgba(255, 210, 120, 0.12)'; b.lineWidth = 1;
      for (let i = -16; i <= 16; i++) { b.beginPath(); b.moveTo(W / 2 + i * W * 0.03, yF); b.lineTo(W / 2 + i * W * 0.07, H); b.stroke(); }
      b.fillStyle = '#8f1029'; b.beginPath(); b.moveTo(W * 0.4, yF); b.lineTo(W * 0.6, yF); b.lineTo(W * 0.66, H); b.lineTo(W * 0.34, H); b.closePath(); b.fill();
      b.strokeStyle = '#e8b43a'; b.lineWidth = 2; b.beginPath(); b.moveTo(W * 0.405, yF); b.lineTo(W * 0.35, H); b.moveTo(W * 0.595, yF); b.lineTo(W * 0.65, H); b.stroke();
      const cw = Math.max(40, W * 0.035);
      for (const side of [0, 1]) {
        b.save(); if (side) { b.translate(W, 0); b.scale(-1, 1); }
        const cg = b.createLinearGradient(0, 0, cw * 1.3, 0); for (let i = 0; i <= 6; i++) cg.addColorStop(i / 6, i % 2 ? '#b8173a' : '#55061a');
        b.fillStyle = cg; b.beginPath(); b.moveTo(0, 0); b.lineTo(cw * 1.3, 0);
        b.bezierCurveTo(cw * 1.15, H * 0.3, cw * 0.55, H * 0.5, cw * 0.62, H * 0.6); b.bezierCurveTo(cw * 0.7, H * 0.72, cw * 1.25, H * 0.9, cw * 1.35, H); b.lineTo(0, H); b.closePath(); b.fill();
        b.fillStyle = '#e8b43a'; b.beginPath(); b.ellipse(cw * 0.32, H * 0.6, cw * 0.44, 7, -0.1, 0, TAU); b.fill();
        b.restore();
      }
      const sc = 110, vh = 64;
      b.fillStyle = '#7c0d25'; b.fillRect(0, 0, W, vh * 0.55);
      for (let x = 0; x < W + sc; x += sc) { b.beginPath(); b.moveTo(x, vh * 0.5); b.quadraticCurveTo(x + sc / 2, vh * 1.45, x + sc, vh * 0.5); b.closePath(); b.fill(); }
      b.strokeStyle = '#e8b43a'; b.lineWidth = 3; b.beginPath(); for (let x = 0; x < W + sc; x += sc) { b.moveTo(x, vh * 0.5); b.quadraticCurveTo(x + sc / 2, vh * 1.45, x + sc, vh * 0.5); } b.stroke();
      b.fillStyle = '#ffcf4a'; for (let x = 0; x < W + sc; x += sc) b.fillRect(x - 2, vh * 0.42, 4, vh * 0.5);
      layer = c;
      const rnd = (a, z) => a + Math.random() * (z - a);
      glit = Array.from({ length: 34 }, () => ({ x: rnd(0, W), y: rnd(0, H), v: rnd(12, 30), r: rnd(2.5, 6), ph: rnd(0, TAU), sw: rnd(0.4, 1.2) }));
    }
    const star = (x, y, r) => { g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r); g.fill(); };
    function frame(now) {
      if (!cv.isConnected) return;
      requestAnimationFrame(frame);
      const w = window.innerWidth, h = window.innerHeight, d = Math.min(1.5, window.devicePixelRatio || 1);
      if (w !== W || h !== H || d !== D) { W = w; H = h; D = d; cv.width = W * D; cv.height = H * D; build(); }
      const t = now / 1000;
      g.setTransform(D, 0, 0, D, 0, 0);
      g.drawImage(layer, 0, 0, W, H);
      g.save(); g.translate(W / 2, H * 0.12); g.rotate(t * 0.05); g.fillStyle = st.rev ? 'rgba(255, 80, 140, 0.07)' : 'rgba(255, 214, 90, 0.05)';
      const R = Math.max(W, H) * 0.8;
      for (let i = 0; i < 16; i++) { g.rotate(TAU / 16); g.beginPath(); g.moveTo(0, 0); g.lineTo(R, -R * 0.08); g.lineTo(R, R * 0.08); g.closePath(); g.fill(); }
      g.restore();
      if (st.rev) { const p = 0.18 + 0.08 * Math.sin(t * 3); const rr = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.7); rr.addColorStop(0, `rgba(255,40,110,${p})`); rr.addColorStop(1, 'rgba(60,0,30,0.35)'); g.fillStyle = rr; g.fillRect(0, 0, W, H); }
      g.fillStyle = st.rev ? '#ff9ad0' : '#ffd96a';
      for (const p of glit) {
        const y = ((p.y - t * p.v) % H + H) % H;
        g.globalAlpha = 0.3 + 0.45 * (0.5 + 0.5 * Math.sin(t * 2 * p.sw + p.ph));
        star(p.x + Math.sin(t * p.sw + p.ph) * 12, y, p.r);
      }
      g.globalAlpha = 1;
    }
    requestAnimationFrame(frame);
    return st;
  }
  // A screen with the throne room behind it: `el` keeps a fixed canvas and a morphed stage.
  function stageIn(el, cls) {
    let root = el.firstElementChild;
    if (!root || !root.classList.contains('pr-root')) {
      el.innerHTML = '<div class="pr-root"><canvas class="pr-bg"></canvas><div class="pr-stage"></div></div>';
      root = el.firstElementChild; root._bg = backdrop(root.firstElementChild);
    }
    root.className = 'pr-root ' + (cls || '');
    return root;
  }

  // A big one-shot proclamation across the TV (revolutions, the final round, first out).
  function flash(html, cls) {
    const d = document.createElement('div'); d.className = 'pr-flash ' + (cls || ''); d.innerHTML = `<div class="pr-flash-in">${html}</div>`;
    document.body.appendChild(d); setTimeout(() => d.remove(), 2600);
  }

  // ---------- TV lobby: the royal court ----------
  const CLAUSE = {
    rounds: ['Rounds of play', 'How many hands the court will play', (v) => v],
    tableSize: ['Seats at each table', 'Bigger courts split into tables', (v) => v],
    turnSeconds: ['Time to make a move', 'Seconds on the royal hourglass', (v) => v + 's'],
    trading: ['The Scum pays tribute', 'Their best cards go to the President'],
    promotion: ['Rise and fall', 'Presidents move up a table, Scums move down'],
    twos: ['A 2 burns the pile', 'Play a 2 and lead again'],
    revolution: ['Revolution!', 'Four of a kind flips the ranks'],
    finalDouble: ['A grand finale', 'The last round scores double'],
    showIntro: ['The herald’s fanfare', 'Play the opening cutscene'],
  };
  const isBool = (f) => f.type === 'bool' || (f.options.length === 2 && f.options.every((o) => typeof o.value === 'boolean'));
  function clause(f, val) {
    const meta = CLAUSE[f.key] || [f.label, ''];
    const sel = `<select class="pr-hide" data-set="${esc(f.key)}" tabindex="-1" aria-label="${esc(f.label)}">${f.options.map((o) => `<option value="${esc(String(o.value))}" ${String(val) === String(o.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
    if (isBool(f)) {
      const on = val === true || val === 'true';
      return `<div class="prl-clause seal ${on ? 'on' : 'off'}"><button class="prl-seal" data-k="${esc(f.key)}" data-v="${on ? 'false' : 'true'}" title="${esc(f.label)}">${WAX(on ? '♛' : '✕')}</button>
        <div class="prl-ctext"><b>${esc(meta[0])}</b><small>${esc(meta[1])}</small></div><span class="prl-onoff">${on ? 'Decreed' : 'Struck out'}</span>${sel}</div>`;
    }
    const lab = meta[2] || ((v) => String(f.options.find((o) => o.value === v).label).replace(/ (rounds|seconds|hands|chips)$/, ''));
    return `<div class="prl-clause coins"><div class="prl-ctext"><b>${esc(meta[0])}</b><small>${esc(meta[1])}</small></div>
      <div class="prl-coins">${f.options.map((o) => `<button class="prl-coin ${String(val) === String(o.value) ? 'on' : ''}" data-k="${esc(f.key)}" data-v="${esc(String(o.value))}" title="${esc(o.label)}">${esc(String(lab(o.value)))}</button>`).join('')}</div>${sel}</div>`;
  }
  let lobbyErr = '';
  function courtier(p, i, vip) {
    const suit = SUITS[i % 4], red = i % 4 === 1 || i % 4 === 2;
    return `<span class="chip pr-courtier ${p.online === false ? 'off' : ''} ${p.bot ? 'bot' : ''} ${vip ? 'vip' : ''}" id="prc-${esc(p.id)}" data-kick="${esc(p.id)}" style="--c:${esc(p.color || '#c8962a')};--d:${(i % 7) * 0.23}s" title="Click to remove">
      ${vip ? CROWN('pr-vipcrown') : ''}<span class="pr-cc ${red ? 'red' : ''}"><em>${suit}</em><span class="av">${esc(p.avatar || '🙂')}</span><em class="b">${suit}</em></span><span class="pr-cn">${esc(p.name)}</span></span>`;
  }
  function lobbyTv(el, L) {
    const root = stageIn(el, 'pr-in-lobby'), stage = root.lastElementChild;
    const n = L.players.length, can = n >= L.min;
    const sizeCls = n > 40 ? 'tiny' : n > 18 ? 'small' : '';
    const html = `<div class="prl">
      <section class="prl-decree"><div class="prl-roll"></div><div class="prl-paper">
        <div class="prl-hdr"><small>By order of the Crown</small><h2>Royal Decree</h2><p>Let it be known: these are the rules of this court.</p></div>
        <div class="settings prl-rules" id="settings">${L.fields.map((f) => clause(f, L.settings[f.key])).join('')}</div>
        <div class="prl-signed"><span>Signed &amp; sealed,</span><i>His Majesty’s Herald</i>${WAX('♛', 'big')}</div>
      </div><div class="prl-roll b"></div></section>
      <section class="prl-court">
        <div class="prl-plaque"><span class="prl-chain l"></span><span class="prl-chain r"></span><small>Court code</small><div class="prl-code" id="code">${esc(L.code)}</div><span class="prl-url">${esc(L.joinUrl.replace(/^https?:\/\//, '').replace(/\?.*$/, ''))}</span></div>
        <div class="prl-dais">${throneSvg()}<div class="prl-how"><b>Empty your hand first to be crowned.</b><span>3 is lowest · 2 is highest · beat the pile with the same number of cards</span></div></div>
        <div class="prl-carpet"><div class="prl-rostitle">${n ? `The court assembles · <b>${n}</b> ${n === 1 ? 'courtier' : 'courtiers'}` : 'The court awaits its first courtier…'}</div>
          <div class="roster prl-roster ${sizeCls}" id="roster">${L.players.map((p, i) => courtier(p, i, L.vip && p.name === L.vip)).join('')}</div></div>
      </section>
      <aside class="prl-side">
        <div class="prl-invite"><div class="prl-inv-top"><small>You are cordially invited to</small><h3>The Royal Court</h3></div>
          <div class="prl-qrf"><img id="qr" src="${esc(L.qr)}" alt="QR code to join"></div>
          <p class="prl-scan">Scan with your phone to take your seat</p>
          <div class="prl-vip">${L.vip ? `👑 <b>${esc(L.vip)}</b> holds the royal seal and can start from their phone` : 'The first to arrive becomes the host 👑'}</div>
          ${WAX('P', 'inv')}
        </div>
        <button class="prl-start" id="start" ${can ? '' : 'disabled'}>${CROWN()}<span>Open the court</span></button>
        <div class="err prl-err" id="lobby-err">${esc(lobbyErr || (can ? '' : `The court needs ${L.min}+ courtiers`))}</div>
        <div class="prl-links"><button class="link" id="add-bots">+ Summon 5 bot courtiers</button><button class="link" id="rm-bots">Dismiss bots</button><button class="link" id="prl-pick">🎮 Another game</button><a class="link" href="?game=president&new=1">New room</a></div>
      </aside></div>`;
    BOX.morph(stage, html);
    for (const s of stage.querySelectorAll('[data-set]')) s.onchange = () => L.set(s.dataset.set, s.value);
    for (const b of stage.querySelectorAll('[data-k]')) b.onclick = () => { L.set(b.dataset.k, b.dataset.v); BOX.sfx(b.classList.contains('prl-seal') ? 'gavel' : 'ballot'); };
    for (const c of stage.querySelectorAll('[data-kick]')) c.onclick = () => { if (confirm('Remove this player?')) L.kick(c.dataset.kick); };
    stage.querySelector('#start').onclick = async () => { const r = await L.start(); lobbyErr = r && r.ok ? '' : (r && r.error) || ''; const e = stage.querySelector('#lobby-err'); if (e) e.textContent = lobbyErr; };
    stage.querySelector('#add-bots').onclick = () => L.bots(5);
    stage.querySelector('#rm-bots').onclick = () => L.removeBots();
    stage.querySelector('#prl-pick').onclick = () => L.pick();
  }

  // ---------- TV game ----------
  function seat(x, t, s, size) {
    const turn = t.turn === x.id;
    const state = x.place ? `<span class="place">${x.place === 1 ? '🥇' : '#' + x.place}</span>` : x.gone ? '<span class="tag">left</span>' : x.passed ? '<span class="tag">pass</span>' : `<span class="cnt"><i class="mini-back" style="${backStyle(x)}"></i>${x.cards}</span>`;
    const ttl = size === 'xs' || size === 'sm' ? (x.title ? TITLE_ICON[x.title] : '') : badge(x.title, s.titleNames);
    return `<div class="pr-seat ${turn ? 'turn' : ''} ${x.passed ? 'passed' : ''} ${x.place ? 'out' : ''} ${x.idle ? 'idle' : ''}" id="ps-${esc(x.id)}">
      <span class="dot" style="background:${esc(x.color || '#888')}"></span>${av(x)}<span class="nm">${esc(x.name)}</span>${state}${ttl}</div>`;
  }
  // One seat around the big oval table: a portrait medallion, a name plate and the cards held.
  function seatLg(x, t, s, i, n) {
    const turn = t.turn === x.id, a = Math.PI / 2 + (i * 2 * Math.PI) / n;
    const px = 50 + Math.cos(a) * 44, py = 50 + Math.sin(a) * 36;
    const fan = Math.min(x.cards, 6);
    const held = x.place ? `<span class="pr-place">${x.place === 1 ? CROWN('sm') + ' Out first!' : 'Out · #' + x.place}</span>` : x.gone ? '<span class="pr-tag">left</span>' : x.passed ? '<span class="pr-tag">passed</span>'
      : `<span class="pr-fan">${Array.from({ length: fan }, (_, k) => `<i style="--k:${k - (fan - 1) / 2};${backStyle(x)}"></i>`).join('')}</span><b class="pr-n">${x.cards}</b>`;
    return `<div class="pr-seat lg ${turn ? 'turn' : ''} ${x.passed ? 'passed' : ''} ${x.place ? 'out' : ''} ${x.idle ? 'idle' : ''} ${py < 50 ? 'up' : ''}" id="ps-${esc(x.id)}" style="left:${px.toFixed(2)}%;top:${py.toFixed(2)}%;--c:${esc(x.color || '#c8962a')}">
      ${x.title ? `<span class="pr-medal t-${x.title}" title="${esc(s.titleNames[x.title])}">${TITLE_ICON[x.title]}</span>` : ''}
      <div class="pr-port"><span>${esc(x.av || '🙂')}</span></div>
      <div class="pr-plate"><span class="nm">${esc(x.name)}</span><span class="pr-held">${held}</span></div>
      ${turn ? `<div class="pr-hg">⏳ ${timer(t.endsIn)}</div>` : ''}</div>`;
  }
  function logLine(l) {
    if (l.burn) return `<li class="burn">🔥 ${esc(l.name)} burned the pile</li>`;
    if (l.pass) return `<li class="pass">${esc(l.name)} ${l.auto ? 'can’t beat it' : 'passed'}</li>`;
    return `<li>${esc(l.name)} played ${l.cards.map((c) => card(c, { size: 'xs' })).join('')}</li>`;
  }
  function spotlight(t, s) {
    if (t.done) return '<div class="pr-spot done">✅ Table finished</div>';
    if (s.phase === 'trade') {
      const left = t.trades.filter((tr) => !tr.done);
      return t.trades.length ? `<div class="pr-spot">🔁 ${left.length ? 'Waiting on ' + left.map((tr) => '<b>' + esc(tr.from) + '</b>').join(', ') + ' to give cards back' : 'Tribute paid!'}</div>` : '<div class="pr-spot">Dealing…</div>';
    }
    if (!t.turnName) return '';
    if (t.stuck) return `<div class="pr-spot stuck">😬 <b>${esc(t.turnName)}</b> can’t beat that… passing</div>`;
    return `<div class="pr-spot"><b>${esc(t.turnName)}</b>${t.top ? ' to beat it' : ' leads a new trick'} ${timer(t.endsIn)}</div>`;
  }
  function trades(t) {
    if (!t.trades.length) return '';
    return `<div class="pr-trades">${t.trades.map((tr) => `<div class="${tr.done ? 'done' : ''}"><span class="ic">${tr.n === 2 ? '🧹' : '🧽'}</span><span><b>${esc(tr.to)}</b> paid ${tr.n === 2 ? 'their 2 best cards' : 'their best card'} to <b>${esc(tr.from)}</b><small>${tr.done ? '✓ cards given back' : esc(tr.from) + ' picks ' + plural(tr.n, 'card') + ' to give back…'}</small></span></div>`).join('')}</div>`;
  }
  const tilt = (c, i, k) => ((hashOf(c + k) % 17) - 8) + (i - k) * 2;
  function pile(t, size) {
    const sz = size === 'xs' ? 'xs' : size === 'lg' ? 'lg' : 'sm';
    if (t.top) {
      const n = t.top.cards.length;
      const under = (t.under || []).slice(-6).map((c, i) => card(c, { size: sz, attrs: `style="--r:${(hashOf(c) % 70) - 35}deg;--dx:${(hashOf(c + 'x') % 110) - 55}px;--dy:${(hashOf(c + 'y') % 40) - 20}px;--z:${i}"` })).join('');
      return `${under ? `<div class="pr-under">${under}</div>` : ''}<div class="cards pile n${n}" id="pile-${t.id}-${t.plays}">${t.top.cards.map((c, i) => card(c, { size: sz, attrs: `style="--r:${tilt(c, i, (n - 1) / 2)}deg"` })).join('')}</div><div class="by">${esc(t.top.name)} · ${setName(n)}</div>`;
    }
    if (t.burn) return `<div class="lead burnt" id="burn-${t.id}-${t.plays}"><span class="pr-flame">🔥</span>${esc(t.burn)} burned the pile!</div>`;
    return `<div class="lead muted">${t.done ? 'Table finished' : 'New trick'}</div>`;
  }
  function table(t, s, size) {
    const n = s.tables.length;
    if (size === 'lg') {
      const center = s.phase === 'trade' && t.trades.length ? `<div class="pr-tribute"><h4>Royal tribute</h4>${trades(t)}</div>` : `<div class="pr-felt">${pile(t, size)}</div>`;
      return `<div class="pr-table lg ${t.done ? 'done' : ''} ${t.rev ? 'rev' : ''}">
        ${n > 1 ? `<div class="pr-th"><span>${tname(t.id, n)}</span></div>` : ''}
        <div class="pr-oval"><div class="pr-oval-in">${t.rev ? '<div class="pr-revring">✊ REVOLUTION · LOW BEATS HIGH ✊</div>' : ''}${center}${spotlight(t, s)}
          ${t.log.length ? `<ul class="pr-log">${t.log.slice(0, 3).map(logLine).join('')}</ul>` : ''}</div></div>
        <div class="pr-seats">${t.seats.map((x, i) => seatLg(x, t, s, i, t.seats.length)).join('')}</div></div>`;
    }
    const showLog = size === 'md' && n <= 2;
    return `<div class="pr-table ${size} ${t.done ? 'done' : ''} ${t.rev ? 'rev' : ''} ${t.id === 0 && n > 1 ? 'palace' : ''}">
      <div class="pr-th"><span>${tname(t.id, n)}</span>${t.rev ? '<span class="pr-revtag">✊ REVOLUTION</span>' : ''}</div>
      <div class="pr-felt">${pile(t, size)}</div>
      ${size === 'xs' ? '' : spotlight(t, s)}
      <div class="pr-seats">${t.seats.map((x) => seat(x, t, s, size)).join('')}</div>
      ${s.phase === 'trade' && size !== 'xs' ? trades(t) : ''}
      ${showLog && t.log.length ? `<ul class="pr-log">${t.log.slice(0, 3).map(logLine).join('')}</ul>` : ''}</div>`;
  }
  function side(s) {
    const r = s.rules;
    return `<aside class="pr-side"><div class="pr-banner-top"></div><h3>Court Rankings</h3>${s.standings.map((x, i) => `<div class="pr-row ${i === 0 ? 'first' : ''}"><span class="n">${i + 1}</span>${av(x)}<span class="nm">${esc(x.name)}</span>${x.title ? `<span class="ti" title="${esc(s.titleNames[x.title])}">${TITLE_ICON[x.title]}</span>` : ''}<b>${x.points}</b></div>`).join('')}
      ${s.players > s.standings.length ? `<div class="pr-more">+${s.players - s.standings.length} more</div>` : ''}
      ${s.waiting.length ? `<p class="pr-more">Dealt in next round: ${s.waiting.map(esc).join(', ')}</p>` : ''}
      <div class="pr-rules"><div>3 low … K A <b>2 high</b></div>${r.twos ? '<div>🔥 A 2 burns the pile</div>' : ''}${r.revolution ? '<div>✊ Four of a kind = Revolution</div>' : ''}</div><div class="pr-banner-tail"></div></aside>`;
  }
  function recap(s) {
    const rc = s.recap || [], shown = rc.slice(0, 6);
    const moves = rc.flatMap((r) => [r.up ? `⬆️ <b>${esc(r.up)}</b> rises to ${tname(r.table - 1, rc.length)}` : null, r.down ? `⬇️ <b>${esc(r.down)}</b> falls to ${tname(r.table + 1, rc.length)}` : null]).filter(Boolean);
    return `<div class="pr-recap"><div class="prl-roll"></div><div class="pr-procl"><small>Royal Proclamation</small><h2>Round ${s.round} results</h2>
      <div class="pr-rgrid n${Math.min(shown.length, 3)}">${shown.map((r) => `<div class="pr-rtable">${rc.length > 1 ? `<h4>${tname(r.table, rc.length)}</h4>` : ''}
        ${r.finish.map((f, i) => `<div class="pr-rrow t-${f.title}" style="--i:${i}"><span class="ic">${TITLE_ICON[f.title]}</span><span class="nm">${esc(f.name)}</span><span class="tt">${esc(s.titleNames[f.title])}</span><b>+${f.pts}</b></div>`).join('')}</div>`).join('')}</div>
      ${rc.length > shown.length ? `<p class="pr-more">+${rc.length - shown.length} more tables</p>` : ''}
      ${moves.length ? `<div class="pr-moves">${moves.slice(0, 8).join(' · ')}</div>` : ''}
      <div class="pr-next">${s.rules.trading ? '🧹 The Scum pays tribute to the President… ' : ''}Next round in ${timer(s.endsIn)}${s.round + 1 === s.rounds ? ' · <b>FINAL ROUND</b>' : ''}</div>${WAX('♛', 'big pr-recap-seal')}</div><div class="prl-roll b"></div></div>`;
  }
  function finale(s) {
    const st = s.standings, w = st[0];
    const step = (x, p) => (x ? `<div class="pd p${p}"><div class="who"><span>${esc(x.av || '🙂')}</span></div><div class="nm">${esc(x.name)}</div><div class="blk"><b>${p}</b><small>${x.points} pts</small></div></div>` : '<div class="pd"></div>');
    return `<div class="pr-over"><div class="pr-hail"><small>All hail</small><h1>${w ? esc(w.name) : 'the President'}</h1><span>President of Presidents · ${w ? w.points : 0} points</span></div>
      <div class="pr-podium">${step(st[1], 2)}<div class="pd p1"><div class="pr-throne-wrap">${throneSvg('big')}<div class="who"><span>${esc((w && w.av) || '👑')}</span></div>${CROWN('pr-dropcrown')}</div></div>${step(st[2], 3)}</div>
      ${(s.awards || []).length ? `<div class="pr-awards">${s.awards.map((a, i) => `<div class="pr-award" style="--i:${i}"><div class="rib"></div><div class="ic">${a.icon}</div><b>${esc(a.title)}</b><div class="who2">${esc(a.name)}</div><small>${esc(a.why)}</small></div>`).join('')}</div>` : ''}
      ${st.length > 3 ? `<div class="pr-rest">${st.slice(3, 10).map((x, i) => `<div class="row"><span class="n">${i + 4}</span><span>${esc(x.av || '')} ${esc(x.name)}</span><b>${x.points}</b></div>`).join('')}</div>` : ''}</div>`;
  }

  // ---------- Phone helpers ----------
  function groups(hand, rev) {
    const g = {};
    for (const c of hand) (g[rankOf(c)] = g[rankOf(c)] || []).push(c);
    return Object.values(g).sort((a, b) => EFF(a[0], rev) - EFF(b[0], rev));
  }
  function options(v) {
    const t = v.table, rev = t.rev, gs = groups(v.hand, rev);
    if (!t.top) return gs.map((g) => g.slice()); // leading: any whole set (tap cards to split one)
    const need = t.top.cards.length, beat = EFF(t.top.cards[0], rev);
    return gs.filter((g) => g.length >= need && EFF(g[0], rev) > beat).map((g) => g.slice(0, need));
  }
  function legal(v, sel) {
    const t = v.table;
    if (!sel.length || sel.length > 4 || !sel.every((c) => rankOf(c) === rankOf(sel[0]))) return false;
    return !t.top || (sel.length === t.top.cards.length && EFF(sel[0], t.rev) > EFF(t.top.cards[0], t.rev));
  }
  // Haptics at the big moments: compare with the last view this phone drew.
  let prev = null;
  function feel(v, ctx) {
    const p = prev || {}, h = (k) => ctx.haptic(k);
    const cur = { phase: v.phase, round: v.round, myTurn: !!(v.myTurn && !v.stuck), give: !!v.give, gave: !!v.gave, place: v.place || 0, rev: !!(v.table && v.table.rev), tableNo: v.tableNo || 0, final: !!v.final };
    if (prev) {
      if (cur.phase === 'over' && p.phase !== 'over') h(v.rank === 1 ? 'win' : 'success');
      else if (cur.phase === 'break' && p.phase !== 'break') h(v.title === 'president' ? 'win' : v.title === 'scum' ? 'buzz' : 'select');
      else if (cur.round !== p.round && cur.final) h('big');
      else if (cur.round !== p.round && cur.tableNo && p.tableNo && cur.tableNo !== p.tableNo) h(cur.tableNo < p.tableNo ? 'success' : 'warn');
      if (cur.give && !p.give) h('success');
      if (cur.gave && !p.gave) h('error');
      if (cur.myTurn && !p.myTurn) h('turn');
      if (cur.place && !p.place) h(cur.place === 1 ? 'win' : 'success');
      if (cur.rev !== p.rev && cur.round === p.round) h('big');
    }
    prev = cur;
  }

  BOX.games.president = {
    // Soundtrack cue per phase (public/box/scores/<key>.js); the TV turns the last 10 s of 'think' tense.
    music: (s) => (s.phase === 'over' ? 'finale' : s.phase === 'break' ? 'reveal' : s.phase === 'trade' ? 'think' : (s.tables || []).some((t) => t.rev) ? 'tense' : 'play'),
    name: 'President', icon: '👑',
    about: 'Climb from Scum to President. First to get rid of their cards rules the next round.',
    how: [
      'Play a single, pair, triple or four of a kind. The next player must beat it with the same number of cards.',
      '3 is the lowest card. Then 4 … K, A, and 2 is the highest. A 2 clears the pile and you lead again.',
      'Can’t beat it? You pass automatically. When everyone passes, the last player to play starts a new trick.',
      'Four of a kind starts a REVOLUTION: the order flips and low cards beat high ones until the next deal.',
      'First out is President, last is Scum. Next round the Scum hands over their two best cards! The last round scores double.',
      'Big group? Several tables play at once. Presidents move up a table, Scums move down.',
    ],
    fx: { card: 'deal', big: 'flip', burn: 'explosion', clear: 'poof', out: 'cheer', tableDone: 'chime', shuffle: 'shuffle', win: 'win', revolution: 'thunder', final: 'drum', roundOver: 'bell', give: 'whoosh' },
    onFx(f) {
      if (f.kind === 'revolution') flash(`<div class="ic">✊</div><div class="big">${f.rev ? 'Revolution!' : 'Counter-revolution!'}</div><div>${esc(f.name || '')} ${f.rev ? 'flipped the ranks: low cards win now!' : 'flipped the ranks back!'}</div>`, 'rev');
      else if (f.kind === 'final') flash('<div class="ic">🏁</div><div class="big">The Final Round</div><div>Every title scores double!</div>', 'fin');
      else if (f.kind === 'out' && f.place === 1) flash(`${CROWN('fl')}<div class="big">${esc(f.name || '')}</div><div>is out first and takes the throne!</div>`, 'out');
    },
    lobbyTv,

    tv(el, s) {
      if (!s) return;
      const root = stageIn(el, 'pr-in-game'), stage = root.lastElementChild;
      root._bg.rev = s.phase === 'play' && s.tables.some((t) => t.rev);
      if (s.phase === 'over') { BOX.morph(stage, finale(s)); return; }
      const n = s.tables.length, size = n === 1 ? 'lg' : n <= 4 ? 'md' : n <= 9 ? 'sm' : 'xs';
      const status = s.phase === 'trade' ? `🔁 Paying tribute ${timer(s.endsIn)}` : s.phase === 'break' ? `The round is over! Next round in ${timer(s.endsIn)}` : n > 1 ? `${n} tables playing at once` : 'Beat the cards on the table!';
      const head = `<div class="pr-banner"><span class="pr-ribbon"><span>Round ${s.round} of ${s.rounds}</span></span>${s.final ? '<span class="pr-final">🏁 FINAL ROUND · double points</span>' : ''}<span class="st">${status}</span></div>`;
      const body = s.phase === 'break' ? recap(s) : `<div class="pr-grid ${size}">${s.tables.map((t) => table(t, s, size)).join('')}</div>`;
      BOX.morph(stage, `<div class="pr-tv">${head}<div class="pr-wrap">${body}${side(s)}</div></div>`);
    },

    // Shown under "You're in!" on the phone in the lobby.
    lobby(view) {
      return `<div class="pr-invite-ph"><div class="pr-ladder">${['president', 'vp', 'citizen', 'vscum', 'scum'].map((k, i) => `<div class="rung r${i}"><span>${TITLE_ICON[k]}</span><b>${['President', 'Vice President', 'Citizen', 'Vice Scum', 'Scum'][i]}</b></div>`).join('')}</div>
        <p>Empty your hand first to climb to the top. Last one holding cards is the <b>Scum</b>… and pays tribute next round!</p></div>`;
    },

    phone(el, v, ctx, view) {
      if (!v) return;
      feel(v, ctx);
      if (v.phase === 'over') {
        const me = v.awards && v.awards.length ? v.awards.map((a) => `<div class="pr-myaward"><span>${a.icon}</span><div><b>${esc(a.title)}</b><small>${esc(a.why)}</small></div></div>`).join('') : '';
        BOX.morph(el, `<div class="pr-ph"><div class="card-box pr-endbox ${v.rank === 1 ? 'champ' : ''}">${v.rank === 1 ? CROWN('pr-endcrown') : ''}<div class="pr-endrank">#${v.rank}</div><h3>${v.rank === 1 ? 'President of Presidents!' : v.rank <= 3 ? 'A noble finish!' : 'The court is adjourned'}</h3><p>${v.points} points · of ${v.of} players</p>${me}</div><div class="card-box pr-final10">${BOX.board(v.final10 || [], (r) => r.points, ' pts')}</div></div>`);
        return;
      }
      if (v.waiting) { BOX.morph(el, '<div class="pr-ph"><div class="card-box pr-wait"><div class="pr-wait-ic">⏳</div><h3>You’re in the court!</h3><p>You’ll be dealt in when the next round starts. Watch the big screen to learn the ropes.</p></div></div>'); return; }
      const hand = v.hand, t = v.table;
      const key = v.round + ':' + (v.give ? 'g' : 'p');
      if (key !== selKey) { selKey = key; selected.clear(); }
      selected = new Set([...selected].filter((c) => hand.includes(c)));
      const ttl = v.title || 'none';
      const head = `<div class="pr-me"><div class="pr-medallion t-${ttl}"><span>${v.title ? TITLE_ICON[v.title] : '🃏'}</span></div><div class="pr-meinfo"><b>${v.title ? esc(v.titleNames[v.title]) : 'Commoner'}</b><span>Round ${v.round}/${v.rounds}${v.final ? ' · <i class="pr-final sm">×2 points</i>' : ''}</span><span>${v.tables > 1 ? (v.tableNo === 1 ? '👑 Palace' : 'Table ' + v.tableNo) + ' · ' : ''}#${v.rank} of ${v.of} · ${v.points} pts</span></div></div>`;
      const others = `<div class="pr-others">${t.seats.map((x) => `<span class="${t.turn === x.id ? 'turn' : ''} ${x.passed ? 'passed' : ''} ${x.place ? 'out' : ''}"><em>${esc(x.av || '🙂')}</em>${esc(x.name)} <b>${x.place ? (x.place === 1 ? '🥇' : '#' + x.place) : x.passed ? 'pass' : x.cards}</b></span>`).join('')}</div>`;
      const revNote = t.rev ? '<div class="pr-revtag ph">✊ REVOLUTION: low cards beat high!</div>' : '';
      let action = '', topHtml = '', opts = [];
      if (v.give) {
        action = `<div class="card-box pr-give"><h3>🎁 Tribute received!</h3>
          <div class="pr-swap"><span>${esc(v.give.to)} had to hand you</span><div class="cards">${v.give.got.map((c) => card(c, { size: 'sm' })).join('')}</div></div>
          <p>Now pick ${v.give.n === 1 ? 'a card' : v.give.n + ' cards'} below to give back to ${esc(v.give.to)} (your worst ones!). ${timer(v.endsIn)}</p>
          <div class="pr-btns"><button class="btn big pr-gold" id="pr-give" ${selected.size === v.give.n ? '' : 'disabled'}>Give ${selected.size}/${v.give.n}</button><button class="btn pr-ghost" id="pr-givelow">Give my lowest</button></div></div>`;
      } else if (v.phase === 'trade') {
        const row = (txt, cs) => `<div class="pr-swap"><span>${txt}</span><div class="cards">${cs.map((c) => card(c, { size: 'sm' })).join('')}</div></div>`;
        action = `<div class="pr-status">🔁 Paying tribute… ${timer(v.endsIn)}</div>
          ${v.gave ? row(`${v.gave.n > 1 ? 'Your ' + v.gave.n + ' best cards' : 'Your best card'} went to ${esc(v.gave.from)}`, v.gave.cards) + (v.gave.back ? row('You got back', v.gave.back) : `<p class="pr-note">${esc(v.gave.from)} is picking cards to give you back…</p>`) : ''}
          ${v.gaveDone ? row(`✓ You gave ${esc(v.gaveDone.to)}`, v.gaveDone.cards) : ''}`;
      } else if (v.phase === 'break') {
        action = `<div class="pr-status t-${ttl}">${v.title ? TITLE_ICON[v.title] + ' ' : ''}You’re <b>${esc(v.titleNames[v.title] || '…')}</b>${v.earned != null ? ' · +' + v.earned + ' pts' : ''}</div><p class="pr-note">Next round in ${timer(v.endsIn)}. Watch the TV!</p>`;
      } else if (t.done || v.place) {
        action = `<div class="pr-status ${v.place === 1 ? 'won' : ''}">${v.place === 1 ? '🥇 You’re out first!' : v.place ? `You finished #${v.place}` : 'Your table is done.'}</div><p class="pr-note">Waiting for the ${t.done ? 'other tables' : 'others to finish'}…</p>`;
      } else {
        topHtml = `<div class="pr-top ${t.rev ? 'rev' : ''}">${t.top ? `<div class="cards">${t.top.cards.map((c) => card(c)).join('')}</div><div class="cap">${esc(t.top.name)}’s ${setName(t.top.cards.length)} · beat it with a <b>${t.rev ? 'LOWER' : 'higher'}</b> ${setName(t.top.cards.length)}</div>`
          : `<div class="cap big">${v.myTurn ? 'You lead! Play any single, pair, triple or four of a kind.' : t.burn ? '🔥 ' + esc(t.burn) + ' burned the pile' : 'New trick'}</div>`}</div>`;
        if (v.stuck) action = '<div class="pr-status stuck">😬 Nothing beats that. Passing…</div><div class="pr-btns"><button class="btn big pr-gold" id="pr-play" disabled>Play</button><button class="btn big pr-ghost" id="pr-pass">Pass</button></div>';
        else if (v.myTurn) {
          opts = options(v);
          const sel = [...selected], ok = legal(v, sel);
          action = `<div class="pr-status now">${CROWN('st')}<span>Your turn!</span> ${timer(t.endsIn)}</div>
            ${opts.length ? `<div class="pr-optlbl">Tap a set to play it</div><div class="pr-opts">${opts.slice(0, 8).map((o, i) => `<button class="pr-opt" data-opt="${i}">${o.map((c) => card(c, { size: 'sm' })).join('')}</button>`).join('')}</div>` : ''}
            <div class="pr-btns"><button class="btn big pr-gold" id="pr-play" ${ok ? '' : 'disabled'}>${sel.length ? 'Play ' + sel.length + ' selected' : 'Play selected'}</button>${t.top ? '<button class="btn big pr-ghost" id="pr-pass">Pass</button>' : ''}</div>`;
        } else {
          action = `<div class="pr-status wait">⏳ ${esc(t.turnName || '…')}’s turn</div>`;
        }
      }
      if (v.myTurn && !v.stuck && !el.dataset.buzzed) { ctx.sfx('knock'); el.dataset.buzzed = '1'; } else if (!v.myTurn) delete el.dataset.buzzed;
      const canPick = !!v.give || (v.myTurn && !v.stuck);
      BOX.morph(el, `<div class="pr-ph">${head}${others}${revNote}${topHtml}${action}<div class="pr-handwrap"><div class="pr-hand ${canPick ? 'live' : ''}">${hand.map((c) => card(c, { sel: selected.has(c), attrs: 'data-pick' })).join('')}</div><p class="pr-foot">${(() => { const mine = t.seats.find((x) => x.id === (view && view.me && view.me.id)); return backPaint(mine) ? `<i class="mini-back" style="${backStyle(mine)};vertical-align:-2px;margin-right:5px"></i>` : ''; })()}${hand.length} cards in hand${canPick ? ' · tap cards to pick them' : ''}</p></div></div>`);
      for (const c of el.querySelectorAll('[data-pick]')) c.onclick = () => {
        const id = c.dataset.card;
        if (selected.has(id)) selected.delete(id);
        else {
          // Picking a different rank starts a new selection (sets are always one rank).
          if (!v.give && [...selected].some((x) => rankOf(x) !== rankOf(id))) selected.clear();
          if (v.give && selected.size >= v.give.n) selected.delete([...selected][0]);
          selected.add(id);
        }
        ctx.redraw();
      };
      const send = async (cards) => { const r = await ctx.act({ op: 'play', cards }); if (r.ok) { selected.clear(); ctx.sfx('deal'); ctx.haptic(cards.length >= 4 ? 'big' : 'select'); ctx.redraw(); } };
      for (const b of el.querySelectorAll('[data-opt]')) b.onclick = () => { const o = opts[Number(b.dataset.opt)]; if (o) send(o); };
      const play = el.querySelector('#pr-play'); if (play) play.onclick = () => send([...selected]);
      const pass = el.querySelector('#pr-pass'); if (pass) pass.onclick = () => { ctx.act({ op: 'pass' }); selected.clear(); };
      const give = el.querySelector('#pr-give'); if (give) give.onclick = async () => { const r = await ctx.act({ op: 'give', cards: [...selected] }); if (r.ok) { selected.clear(); ctx.sfx('whoosh'); ctx.haptic('success'); } };
      const low = el.querySelector('#pr-givelow'); if (low) low.onclick = async () => { const r = await ctx.act({ op: 'give', cards: hand.slice(0, v.give.n) }); if (r.ok) { selected.clear(); ctx.sfx('whoosh'); ctx.haptic('success'); } };
    },
  };
})();
