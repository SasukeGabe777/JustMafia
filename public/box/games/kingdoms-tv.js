'use strict';
// JustKingdoms on the TV: its own medieval title screen, the Round Table in the lobby (one chair
// per player, where you sit is where your kingdom starts), the full-screen hex world with
// castles, villages, marching banners, battles, alliances, rockets and the Peace Monument, a few
// slim overlays, and the victory screen. Art lives in kingdoms-art.js (window.KINGDOM_ART).
// The phone side (kingdoms-phone.js) adds BOX.games.kingdoms.phone to the same object.
(function () {
  const { esc, mmss } = BOX;
  const A = () => window.KINGDOM_ART;

  // Fonts for the medieval look (loaded once, from Google Fonts like the shell's own fonts).
  if (!document.getElementById('kt-fonts')) {
    const l = document.createElement('link'); l.id = 'kt-fonts'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700;900&family=Cinzel:wght@600;700;800&family=MedievalSharp&display=swap';
    document.head.appendChild(l);
  }

  const AGE_ICON = ['', '🛖', '🏘️', '🏰', '🏙️', '👑'];
  const AGE_NAME = ['', 'Hamlet', 'Village', 'Town', 'City', 'Kingdom'];
  const MODE = { any: ['🌍', 'Anything goes'], conquest: ['⚔️', 'World Domination'], diplomacy: ['🕊️', 'World Diplomacy'], science: ['🚀', 'Science'] };
  const WIN = {
    conquest: ['⚔️', 'World Domination', 'conquered the known world'],
    diplomacy: ['🕊️', 'Peace on Earth', 'built the Peace Monument together'],
    science: ['🚀', 'To the Stars', 'launched the first rocket'],
    score: ['👑', 'The Greatest Kingdom', 'held the highest Kingdom Score'],
  };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const short = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const kname = (k) => (k ? String(k.name).replace(/'s Kingdom$/, '') : '');

  // ---------- TV state kept between updates ----------
  const kv = {
    s: null, recvAt: 0, raf: 0, cv: null, el: null, W: 0, H: 0, dpr: 1,
    layer: null, layerSig: '', L: null, twinkle: [], kById: new Map(), tileAt: new Map(),
    pops: {}, seatT0: 0, bursts: [], flights: [], moments: [], tickSeen: new Map(), lastBattleSnd: 0, overAt: 0, mode: null,
  };
  const tnow = () => performance.now() / 1000;
  const gameNow = () => (kv.s ? kv.s.now + (performance.now() - kv.recvAt) : 0);

  // ---------- title screen ----------
  function titleScreen(el, { start, back, resume, code }) {
    const G = BOX.games.kingdoms;
    el.innerHTML = `<div class="kt-title"><canvas id="kt-title-cv"></canvas>
      <div class="kt-title-card">
        <div class="kt-crest">⚜️</div>
        <div class="kt-logo"><span class="a">Just</span><span class="b">Kingdoms</span></div>
        <p class="kt-tagline">From a muddy hamlet to a mighty empire. Conquer, make peace, or reach the stars.</p>
        ${resume ? `<button class="kt-go" id="kt-resume">▶ Continue world ${esc(code || '')}</button><br>` : ''}<button class="kt-go ${resume ? 'alt' : ''}" id="kt-go">⚔️ Found a new world</button>
        <button class="kt-how-btn" id="kt-how-btn">How to play</button>
        <ol class="kt-how" id="kt-how" hidden>${G.how.map((h) => `<li>${esc(h)}</li>`).join('')}</ol>
        <p class="kt-fine">Open this on the TV. Everyone rules a kingdom from their phone. 1–100 players, best with 5–10.</p>
        <button class="kt-back" id="kt-back">◀ Back to JustGameBox</button>
      </div></div>`;
    el.querySelector('#kt-go').onclick = start;
    const rs = el.querySelector('#kt-resume'); if (rs) rs.onclick = resume;
    el.querySelector('#kt-back').onclick = back;
    el.querySelector('#kt-how-btn').onclick = () => { const h = el.querySelector('#kt-how'); h.hidden = !h.hidden; };
    const cv = el.querySelector('#kt-title-cv');
    cancelAnimationFrame(kv.titleRaf);
    const step = () => {
      if (!document.body.contains(cv)) return;
      const W = cv.clientWidth, H = cv.clientHeight;
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      A().drawTitleScene(cv.getContext('2d'), W, H, tnow());
      kv.titleRaf = requestAnimationFrame(step);
    };
    step();
  }

  // ---------- the canvas loop ----------
  function ensure(el) {
    if (kv.el === el && el.querySelector('#kt-cv')) return;
    kv.el = el; kv.layerSig = ''; kv.mode = null; kv.W = 0; kv.H = 0; kv.lobbySig = ''; // a fresh canvas must be sized again
    el.innerHTML = `<div class="kt-root"><canvas id="kt-cv" class="kt-cv"></canvas><div class="kt-hud" id="kt-hud"></div></div>`;
    kv.cv = el.querySelector('#kt-cv');
    cancelAnimationFrame(kv.raf);
    const step = () => {
      if (!document.body.contains(kv.cv)) return;
      const dpr = Math.min(1.5, window.devicePixelRatio || 1), W = kv.cv.clientWidth, H = kv.cv.clientHeight;
      if (kv.W !== W || kv.H !== H || kv.dpr !== dpr) { kv.W = W; kv.H = H; kv.dpr = dpr; kv.cv.width = Math.round(W * dpr); kv.cv.height = Math.round(H * dpr); kv.layerSig = ''; }
      const g = kv.cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      try { if (kv.s) (kv.s.phase === 'lobby' ? drawLobby : drawWorld)(g, W, H, tnow()); } catch (e) { console.error(e); }
      tickHud();
      kv.raf = requestAnimationFrame(step);
    };
    kv.raf = requestAnimationFrame(step);
  }

  // ---------- lobby: the Round Table ----------
  function tableGeom(W, H) {
    const side = W > 900 ? 330 : 0, aw = W - side;
    const rad = Math.max(70, Math.min(aw * 0.2, H * 0.24));
    return { cx: aw / 2, cy: H * 0.57, rad };
  }
  // cached layers: the hall floor + rug, and the table top (redrawn when seats change)
  function lobbyLayers(W, H, seats) {
    const art = A(), dpr = kv.dpr, { cx, cy, rad } = tableGeom(W, H);
    const sig = W + 'x' + H + ':' + dpr + ':' + seats.map((p) => (p ? p.color : '-')).join(',');
    if (kv.lobbySig === sig) return;
    kv.lobbySig = sig;
    const mk = (c) => { c = c || document.createElement('canvas'); c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); return [c, g]; };
    const [c1, g1] = mk(kv.hall); kv.hall = c1;
    const bg = g1.createRadialGradient(W * 0.4, H * 0.5, 50, W * 0.4, H * 0.5, Math.max(W, H) * 0.8);
    bg.addColorStop(0, '#5a3a22'); bg.addColorStop(1, '#22140a'); g1.fillStyle = bg; g1.fillRect(0, 0, W, H);
    g1.strokeStyle = 'rgba(0,0,0,.25)'; g1.lineWidth = 2; // stone floor
    for (let y = 0, row = 0; y < H; y += 70, row++) { g1.beginPath(); g1.moveTo(0, y); g1.lineTo(W, y); g1.stroke(); for (let x = (row % 2) * 60; x < W; x += 120) { g1.beginPath(); g1.moveTo(x, y); g1.lineTo(x, y + 70); g1.stroke(); } }
    art.tableRug(g1, cx, cy, rad);
    const [c2, g2] = mk(kv.top); kv.top = c2;
    g2.clearRect(0, 0, W, H); art.tableTop(g2, cx, cy, rad, seats);
  }
  function drawLobby(g, W, H, t) {
    const s = kv.s, N = Math.max(s.tableSize || 0, 1);
    const { cx, cy, rad } = tableGeom(W, H);
    const seats = new Array(s.tableSize || 0).fill(null);
    for (const p of s.seats || []) if (Number.isInteger(p.seat) && p.seat >= 0 && p.seat < seats.length) seats[p.seat] = p;
    lobbyLayers(W, H, seats);
    g.drawImage(kv.hall, 0, 0, W, H);
    const pos = A().tableChairs(g, cx, cy, rad, seats, t, kv.pops);
    g.drawImage(kv.top, 0, 0, W, H);
    A().tableCandles(g, cx, cy, rad, t);
    // name plates outside the chairs
    const many = N > 20;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    pos.forEach((P) => {
      const p = seats[P.i]; if (!p && many) return;
      const out = rad * 1.18 + P.cw * 0.5 + (many ? (P.i % 2) * 22 : 0) + 16;
      const x = cx + Math.cos(P.a) * out, y = cy + Math.sin(P.a) * out;
      const fs = clamp(P.cw * 0.3, 11, 20);
      g.font = `700 ${fs}px 'Cinzel', Fredoka, serif`;
      const text = p ? short(p.name, many ? 10 : 16) : 'Sit here!';
      const w = g.measureText(text).width + 16;
      if (p) { g.fillStyle = 'rgba(30,16,6,.85)'; A().roundRect(g, x - w / 2, y - fs * 0.75, w, fs * 1.5, 6); g.fill(); g.strokeStyle = p.color; g.lineWidth = 2; g.stroke(); g.fillStyle = '#fff3d6'; }
      else g.fillStyle = `rgba(255,224,130,${0.6 + Math.sin(t * 3 + P.i) * 0.3})`;
      g.fillText(text, x, y + 1);
    });
    g.textBaseline = 'alphabetic';
  }
  function lobbyHud(s) {
    const hud = kv.el.querySelector('#kt-hud');
    const seated = (s.seats || []).filter((p) => Number.isInteger(p.seat)).length, n = s.tableSize || 0;
    const html = `<div class="kt-lobbycap"><div class="kt-h1">⚜️ The Round Table ⚜️</div>
      <div class="kt-cap">Sit next to friends you want as allies… or enemies you want close.</div>
      <div class="kt-sub">${n ? `${seated} of ${n} seated · pick your chair on your phone` : 'Join on your phone to pull up a chair'}${n && seated < n ? ' · unseated players fill the gaps' : ''}</div></div>`;
    if (hud.dataset.html !== html) { hud.innerHTML = html; hud.dataset.html = html; }
  }

  // ---------- the world ----------
  function layout(W, H, R) {
    const top = 64, bottom = 10;
    return A().fit(R, 0, top, W, H - top - bottom);
  }
  function buildLayer(s, W, H) {
    const art = A(), dpr = kv.dpr, R = s.world.R;
    const L = layout(W, H, R); kv.L = L;
    const tiles = s.world.tiles;
    const mk = (c) => { c = c || document.createElement('canvas'); c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); return [c, g]; };
    // terrain never changes during a game: its own cached layer (the slow one)
    const tsig = W + 'x' + H + ':' + dpr + ':' + R + ':' + tiles.map((T) => T.t + (T.x ? 1 : 0)).join('');
    if (kv.terrainSig !== tsig) {
      const [tc, tg] = mk(kv.terrain); kv.terrain = tc; kv.terrainSig = tsig;
      art.drawSea(tg, W, H); art.drawCoast(tg, tiles, L);
      kv.twinkle = [];
      for (const T of tiles) { const [x, y] = art.toPx(T.q, T.r, L); art.drawTerrain(tg, T, x, y, L.s); if (T.t === 'l' || T.t === 'g') kv.twinkle.push([x, y, T.t]); }
    }
    const [c, g] = mk(kv.layer); kv.layer = c;
    g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(kv.terrain, 0, 0); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const colorOf = (id) => { const k = kv.kById.get(id); return k ? k.color : null; };
    art.drawOwnership(g, tiles, L, colorOf);
    // villages, then capitals (bodies only; flags wave in the live layer), back to front
    const sorted = tiles.filter((T) => T.v > 0 || T.c).sort((a, b) => a.r - b.r || a.q - b.q);
    for (const T of sorted) {
      const [x, y] = art.toPx(T.q, T.r, L), col = colorOf(T.o) || '#999';
      if (T.c) { const k = kv.kById.get(T.c); art.drawCastle(g, x, y, L.s, k ? k.age : 1, k ? k.color : col, T.w || 0, 0, true); }
      else art.drawVillage(g, x, y, L.s, T.v, col, T.w || 0);
    }
  }
  const layerSig = (s, W, H) => W + 'x' + H + ':' + kv.dpr + ':' + s.world.R + ':' + s.world.tiles.map((T) => (T.o || '') + T.v + T.w + T.t).join(',') + ':' + s.kingdoms.map((k) => k.id + k.age + k.color).join(',');

  function hexXY(q, r) { return A().toPx(q, r, kv.L); }
  function armyXY(a, now) {
    const p = a.path || [a.from.q, a.from.r, a.to.q, a.to.r], n = p.length / 2 - 1;
    const f = clamp((now - a.t0) / Math.max(1, a.t1 - a.t0), 0, 1) * Math.max(1, n);
    const i = Math.min(n - 1, Math.floor(f)), u = f - i;
    if (n < 1) return hexXY(p[0], p[1]);
    const [x0, y0] = hexXY(p[i * 2], p[i * 2 + 1]), [x1, y1] = hexXY(p[i * 2 + 2], p[i * 2 + 3]);
    return [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, i, f];
  }
  function drawWorld(g, W, H, t) {
    const s = kv.s, art = A();
    if (!s.world || !s.world.R) { g.fillStyle = '#1d3f5a'; g.fillRect(0, 0, W, H); return; }
    const sig = layerSig(s, W, H);
    if (sig !== kv.layerSig) { buildLayer(s, W, H); kv.layerSig = sig; }
    const L = kv.L, S = L.s, now = gameNow();
    g.drawImage(kv.layer, 0, 0, W, H);
    // water shimmer and gold sparkle
    const rush = s.events && s.events.current && s.events.current.kind === 'goldrush';
    for (const [x, y, k] of kv.twinkle) {
      const ph = (x * 0.13 + y * 0.07) % 6.28;
      if (k === 'l') { const a = 0.25 + Math.sin(t * 1.6 + ph) * 0.2; g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = Math.max(1, S * 0.05); g.beginPath(); const dx = Math.sin(t * 0.8 + ph) * S * 0.2; g.moveTo(x - S * 0.3 + dx, y + S * 0.12); g.quadraticCurveTo(x + dx, y + S * 0.02, x + S * 0.3 + dx, y + S * 0.12); g.stroke(); }
      else { const a = Math.max(0, Math.sin(t * (rush ? 6 : 2.2) + ph * 3)); if (a > 0.3) { g.fillStyle = `rgba(255,248,180,${a})`; const r = S * (rush ? 0.16 : 0.09) * a, sx = x + Math.cos(ph * 5) * S * 0.35, sy = y + Math.sin(ph * 7) * S * 0.3; g.beginPath(); g.moveTo(sx, sy - r * 2); g.lineTo(sx + r * 0.4, sy); g.lineTo(sx, sy + r * 2); g.lineTo(sx - r * 0.4, sy); g.closePath(); g.fill(); g.beginPath(); g.moveTo(sx - r * 2, sy); g.lineTo(sx, sy + r * 0.4); g.lineTo(sx + r * 2, sy); g.lineTo(sx, sy - r * 0.4); g.closePath(); g.fill(); } }
    }
    // the Ancient Ruins glow
    { const [x, y] = hexXY(0, 0); const gl = g.createRadialGradient(x, y, 2, x, y, S * 1.6); gl.addColorStop(0, `rgba(255,230,140,${0.22 + Math.sin(t * 1.5) * 0.08})`); gl.addColorStop(1, 'rgba(255,230,140,0)'); g.fillStyle = gl; g.beginPath(); g.arc(x, y, S * 1.6, 0, Math.PI * 2); g.fill(); }
    const ks = s.kingdoms, capXY = new Map();
    for (const k of ks) capXY.set(k.id, hexXY(k.home.q, k.home.r));
    // alliance threads (members chained in seat order) and war lines (recent battles between two kingdoms)
    for (const Al of s.alliances || []) {
      const mem = Al.members.map((id) => kv.kById.get(id)).filter(Boolean).sort((a, b) => a.seat - b.seat); if (mem.length < 2) continue;
      g.save(); g.strokeStyle = art.rgba(art.allyColor(Al.id), 0.6); g.lineWidth = Math.max(2, S * 0.09); g.setLineDash([S * 0.05, S * 0.2]); g.lineCap = 'round'; g.lineDashOffset = -t * 6;
      g.beginPath(); mem.forEach((k, i) => { const [x, y] = capXY.get(k.id); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke(); g.restore();
    }
    const wars = (s.wars || []).slice().sort((a, b) => a.ago - b.ago).slice(0, 12);
    for (const w of wars) {
      if (!capXY.has(w.a) || !capXY.has(w.b)) continue;
      const [x0, y0] = capXY.get(w.a), [x1, y1] = capXY.get(w.b), fade = clamp(1 - (w.ago + (performance.now() - kv.recvAt)) / 90000, 0, 1); if (fade <= 0) continue;
      g.save(); g.globalAlpha = 0.35 + 0.45 * fade; g.strokeStyle = '#d8281c'; g.lineWidth = Math.max(2, S * (0.06 + Math.min(0.08, w.n * 0.01))); g.setLineDash([S * 0.25, S * 0.12]); g.lineDashOffset = t * 30;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.setLineDash([]);
      g.font = `${Math.round(clamp(S * 0.55, 14, 28))}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('⚔️', (x0 + x1) / 2, (y0 + y1) / 2 + Math.sin(t * 5) * 2); g.restore();
    }
    // vassal chains
    g.save(); g.setLineDash([S * 0.12, S * 0.1]); g.lineWidth = Math.max(1.5, S * 0.06);
    for (const k of ks) if (k.vassalOf && capXY.has(k.vassalOf)) {
      const [x0, y0] = capXY.get(k.id), [x1, y1] = capXY.get(k.vassalOf);
      g.strokeStyle = 'rgba(30,20,10,.55)'; g.lineDashOffset = -t * 8; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.strokeStyle = 'rgba(210,210,220,.85)'; g.lineWidth = Math.max(1, S * 0.03); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.lineWidth = Math.max(1.5, S * 0.06);
    }
    g.restore();
    // alliance rings around allied capitals
    for (const k of ks) if (k.ally) {
      const [x, y] = capXY.get(k.id), col = art.allyColor(k.ally);
      g.save(); g.strokeStyle = 'rgba(20,10,0,.45)'; g.lineWidth = Math.max(3, S * 0.13); g.beginPath(); g.ellipse(x, y + S * 0.1, S * 1.05, S * 0.62, 0, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = col; g.lineWidth = Math.max(2, S * 0.08); g.setLineDash([S * 0.22, S * 0.12]); g.lineDashOffset = t * 12;
      g.beginPath(); g.ellipse(x, y + S * 0.1, S * 1.05, S * 0.62, 0, 0, Math.PI * 2); g.stroke(); g.restore();
    }
    // monument at the centre (diplomacy)
    const pr = s.progress || {};
    if ((s.mode === 'any' || s.mode === 'diplomacy') && pr.monument > 0) {
      const [x, y] = hexXY(0, 0); art.drawMonument(g, x + S * 0.05, y + S * 0.35, S * 0.9, pr.monument, t);
      art.badge(g, x, y + S * 0.72, `🕊️ ${Math.round(pr.monument * 100)}%`, Math.max(10, S * 0.3), 'rgba(255,250,235,.9)', '#4a3410');
    }
    // flags, rockets and labels on capitals
    const labelAll = ks.length <= 20, top = new Set(ks.slice().sort((a, b) => b.score - a.score).slice(0, 10).map((k) => k.id));
    const rockets = new Map((pr.rockets || []).map((r) => [r.id, r]));
    const sortedK = ks.slice().sort((a, b) => a.home.r - b.home.r);
    const leadId = ks.length ? ks.reduce((a, b) => (b.score > a.score ? b : a)).id : null;
    for (const k of sortedK) {
      const [x, y] = capXY.get(k.id), F = art.castleFlag(x, y, S, Math.max(1, Math.min(5, k.age || 1)));
      art.flag(g, F.x, F.y, F.h, k.color, t + k.seat * 0.7, F.big);
      const rk = rockets.get(k.id);
      if (k.stage > 0 || k.building || rk) {
        const px = x + S * 0.95, py = y + S * 0.45;
        art.drawLaunchPad(g, px, py, S, k.stage || 0, !!(k.building || (rk && rk.building)), t);
        if (rk && rk.building) art.badge(g, px, py + S * 0.3, `🚀${rk.building} · ${mmss(Math.max(0, rk.endsIn - (performance.now() - kv.recvAt)))}`, Math.max(10, S * 0.28), 'rgba(160,30,20,.9)');
      }
    }
    // army routes + banners
    const live = [];
    for (const a of s.armies || []) {
      const P = armyXY(a, now); if (!P) continue;
      const k = a.o ? kv.kById.get(a.o) : null, col = k ? k.color : '#151515';
      const p = a.path || [], seg = P[2] || 0;
      if (p.length >= 4) {
        g.save(); g.setLineDash([S * 0.12, S * 0.12]); g.lineDashOffset = -t * 20;
        g.strokeStyle = a.order === 'attack' ? 'rgba(200,30,20,.65)' : art.rgba(col, 0.6); g.lineWidth = Math.max(1.5, S * 0.07);
        g.beginPath(); g.moveTo(P[0], P[1]); for (let i = seg + 1; i < p.length / 2; i++) { const [x, y] = hexXY(p[i * 2], p[i * 2 + 1]); g.lineTo(x, y); } g.stroke(); g.restore();
        const [tx, ty] = hexXY(a.to.q, a.to.r);
        if (a.order === 'attack') { g.strokeStyle = 'rgba(220,40,30,.85)'; g.lineWidth = Math.max(1.5, S * 0.06); const r = S * (0.35 + Math.sin(t * 6) * 0.05); g.beginPath(); g.arc(tx, ty, r, 0, Math.PI * 2); g.moveTo(tx - r * 1.4, ty); g.lineTo(tx + r * 1.4, ty); g.moveTo(tx, ty - r * 1.4); g.lineTo(tx, ty + r * 1.4); g.stroke(); }
      }
      live.push([P[0], P[1], a, col]);
    }
    live.sort((a, b) => a[1] - b[1]);
    const armyScale = Math.min(48, Math.max(S * 1.05, 18));
    for (const [x, y, a, col] of live) art.drawArmy(g, x, y, armyScale, col, a.kind, a.n, t + (a.id ? String(a.id).length : 0), !a.o);
    // battles: clash bursts (last ~8 s) and local fx bursts
    for (const b of s.battles || []) {
      const age = (now - b.at) / 1000; if (age < 0 || age > 8) continue;
      const [x, y] = hexXY(b.q, b.r), wk = b.win && b.win !== 'bandits' ? kv.kById.get(b.win) : null;
      if (age < 2.2) {
        const u = age / 2.2;
        g.strokeStyle = `rgba(255,220,120,${1 - u})`; g.lineWidth = Math.max(2, S * 0.12 * (1 - u)); g.beginPath(); g.arc(x, y, S * (0.3 + u * 1.4), 0, Math.PI * 2); g.stroke();
        for (let i = 0; i < 8; i++) { const a = i * 0.785 + age * 2, r0 = S * (0.2 + u * 0.8), r1 = r0 + S * 0.35 * (1 - u); g.strokeStyle = `rgba(255,${150 + i * 10},60,${1 - u})`; g.beginPath(); g.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); g.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); g.stroke(); }
      }
      const alpha = age < 6 ? 1 : (8 - age) / 2;
      g.globalAlpha = alpha; g.font = `${Math.round(Math.max(16, S * 0.62) * (age < 0.4 ? 1 + (0.4 - age) * 2 : 1))}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(age < 2.5 ? '⚔️' : wk ? '🏳️' : '💥', x, y - S * 0.15 + Math.sin(age * 10) * (age < 2.5 ? 2 : 0));
      if (wk && age >= 2.5) { g.fillStyle = wk.color; g.beginPath(); g.arc(x + S * 0.3, y - S * 0.35, S * 0.12, 0, Math.PI * 2); g.fill(); }
      g.globalAlpha = 1; g.textBaseline = 'alphabetic';
    }
    const T = tnow();
    kv.bursts = kv.bursts.filter((b) => T - b.at < b.dur);
    for (const b of kv.bursts) {
      const u = (T - b.at) / b.dur, [x, y] = hexXY(b.q, b.r);
      if (b.kind === 'capture') { g.strokeStyle = art.rgba(b.color || '#ffd34d', 1 - u); g.lineWidth = Math.max(3, S * 0.18 * (1 - u)); art.hexPath(g, x, y, S * (0.9 + u * 1.4)); g.stroke(); }
      else if (b.kind === 'village') { g.strokeStyle = `rgba(255,255,255,${1 - u})`; g.lineWidth = 3; g.beginPath(); g.arc(x, y, S * (0.3 + u * 1.2), 0, Math.PI * 2); g.stroke(); }
      else if (b.kind === 'age') { g.save(); g.translate(x, y - S * 0.4); g.rotate(T * 0.8); for (let i = 0; i < 12; i++) { g.rotate(Math.PI / 6); g.fillStyle = `rgba(255,220,90,${0.5 * (1 - u)})`; g.beginPath(); g.moveTo(0, 0); g.lineTo(S * 2.2 * (0.4 + u), -S * 0.15); g.lineTo(S * 2.2 * (0.4 + u), S * 0.15); g.fill(); } g.restore(); }
      else if (b.kind === 'gift') { g.globalAlpha = 1 - u; g.font = `${Math.round(S * 0.7)}px serif`; g.textAlign = 'center'; g.fillText('🎁', x, y - S * (0.6 + u * 1.2)); g.globalAlpha = 1; }
    }
    // capital labels, garrisons, traitors, messages
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const fs = clamp(S * 0.34, 10, 17);
    for (const k of sortedK) {
      const [x, y] = capXY.get(k.id);
      const T0 = kv.tileAt.get(k.home.q + ',' + k.home.r);
      if (labelAll || top.has(k.id) || k.msg) {
        const label = `${k.avatar ? k.avatar + ' ' : ''}${AGE_ICON[k.age] || ''} ${short(kname(k), labelAll ? 16 : 10)}${k.vassalOf ? ' ⛓️' : ''}`;
        g.font = `700 ${fs}px 'Cinzel', Fredoka, serif`;
        const w = g.measureText(label).width + fs * 0.9, ly = y + S * 0.82;
        g.fillStyle = 'rgba(28,16,6,.82)'; art.roundRect(g, x - w / 2, ly - fs * 0.72, w, fs * 1.44, fs * 0.3); g.fill();
        g.fillStyle = k.color; g.fillRect(x - w / 2 + 3, ly - fs * 0.72 + 2, 3, fs * 1.44 - 4);
        g.fillStyle = k.gone ? '#bba98a' : '#fff3d6'; g.fillText(label, x + 2, ly + 1);
      }
      if (T0 && T0.g > 0 && S >= 22) art.badge(g, x + S * 0.62, y - S * 0.05, String(T0.g), clamp(S * 0.26, 9, 14), 'rgba(28,16,6,.82)');
      if (k.traitor) { g.font = `${Math.round(S * 0.6)}px serif`; g.fillText('🗡️', x - S * 0.7, y - S * 0.6 + Math.sin(t * 4) * 3); }
      if (k.id === leadId && ks.length > 1) { g.font = `${Math.round(clamp(S * 0.7, 16, 34))}px serif`; g.fillText('👑', x, y - S * 1.25 + Math.sin(t * 2) * 2); }
      if (k.marked) { const r = S * (1.15 + Math.sin(t * 4) * 0.06); g.save(); g.strokeStyle = 'rgba(230,40,30,.9)'; g.lineWidth = Math.max(2, S * 0.07); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.moveTo(x - r * 1.25, y); g.lineTo(x - r * 0.7, y); g.moveTo(x + r * 0.7, y); g.lineTo(x + r * 1.25, y); g.moveTo(x, y - r * 1.25); g.lineTo(x, y - r * 0.7); g.stroke(); g.restore(); }
      if (k.bounty > 0) art.badge(g, x - S * 0.75, y + S * 0.2, `💰${k.bounty}`, clamp(S * 0.28, 10, 15), 'rgba(120,70,0,.92)', '#ffe9a8');
      if (k.sanction > 0) art.badge(g, x + S * 0.7, y + S * 0.35, '⚖️ −30%', clamp(S * 0.24, 9, 13), 'rgba(90,40,140,.9)');
      if (k.msg && k.msg.endsIn > 0) {
        const left = k.msg.endsIn - (performance.now() - kv.recvAt); if (left <= 0) continue;
        const text = k.msg.text || '', mf = clamp(S * 0.42, 13, 22);
        g.font = `700 ${mf}px Fredoka, sans-serif`;
        const w = g.measureText(text).width + mf * 1.2, h = mf * 1.7, bx = x, by = y - S * 1.55 - Math.min(1, (8000 - left) / 300) * 4;
        g.globalAlpha = clamp(left / 600, 0, 1);
        g.fillStyle = '#fffaf0'; art.roundRect(g, bx - w / 2, by - h, w, h, h * 0.4); g.fill();
        g.beginPath(); g.moveTo(bx - 6, by - 1); g.lineTo(bx + 4, by + 10); g.lineTo(bx + 8, by - 1); g.fill();
        g.strokeStyle = k.color; g.lineWidth = 2.5; art.roundRect(g, bx - w / 2, by - h, w, h, h * 0.4); g.stroke();
        g.fillStyle = '#2a1a08'; g.fillText(text, bx, by - h / 2 + 1); g.globalAlpha = 1;
      }
    }
    g.textBaseline = 'alphabetic';
    // rocket lift-offs fly across the screen
    kv.flights = kv.flights.filter((f) => T - f.at < 6);
    for (const f of kv.flights) {
      const u = (T - f.at) / 6, k = kv.kById.get(f.who || f.id), [x0, y0] = k ? capXY.get(k.id) : [W / 2, H / 2];
      const x = x0 + S * 0.95 + Math.sin(u * 3) * 20 + u * u * W * 0.15, y = y0 + S * 0.4 - u * u * (y0 + 300);
      for (let i = 0; i < 18; i++) { const v = u - i * 0.012; if (v < 0) break; g.fillStyle = `rgba(240,240,240,${0.55 - i * 0.03})`; g.beginPath(); g.arc(x0 + S * 0.95 + Math.sin(v * 3) * 20 + v * v * W * 0.15 + Math.sin(i) * 5, y0 + S * 0.4 - v * v * (y0 + 300) + 20, S * 0.2 + i * 2, 0, Math.PI * 2); g.fill(); }
      art.drawRocket(g, x, y, Math.max(60, S * 2.4), 3, t, true, false);
    }
    // the event sky: comet streak
    const ev = s.events && s.events.current;
    if (ev && ev.kind === 'comet') { const u = (t * 0.15) % 1, x = W * (1.1 - u * 1.3), y = H * (0.05 + u * 0.35); const gr = g.createLinearGradient(x, y, x + 260, y - 90); gr.addColorStop(0, 'rgba(255,255,230,.95)'); gr.addColorStop(1, 'rgba(120,200,255,0)'); g.strokeStyle = gr; g.lineWidth = 6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 260, y - 90); g.stroke(); g.fillStyle = '#fffbe0'; g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill(); }
    if (s.phase === 'over') { g.fillStyle = 'rgba(20,10,2,.45)'; g.fillRect(0, 0, W, H); }
  }

  // ---------- overlays (DOM) ----------
  function playHud(s) {
    const hud = kv.el.querySelector('#kt-hud');
    if (kv.mode !== 'play') {
      kv.mode = 'play';
      hud.innerHTML = `<div class="kt-top" id="kt-top"></div><div class="kt-event" id="kt-event" hidden></div>
        <div class="kt-list" id="kt-list"></div><div class="kt-ticker" id="kt-ticker"></div><div class="kt-moments" id="kt-moments"></div>
        <div class="kt-side"><div class="kt-council" id="kt-council" hidden></div><div class="kt-threats" id="kt-threats" hidden></div><div class="kt-race" id="kt-race"></div></div>`;
      hud.dataset.html = ''; hud.dataset.sig = '';
    }
    const [mi, ml] = MODE[s.mode] || MODE.any, pr = s.progress || {};
    const bits = [];
    const lead = pr.leader && kv.kById.get(pr.leader);
    if (s.mode === 'any' || s.mode === 'conquest') bits.push(`<span class="kt-prog" title="Capitals held">⚔️ ${lead ? `<i style="background:${esc(lead.color)}"></i>` : ''}${pr.capitals || 0}/${pr.of || 0}</span>`);
    if (s.mode === 'any' || s.mode === 'diplomacy') bits.push(`<span class="kt-prog" title="Peace Monument">🕊️ ${Math.round((pr.monument || 0) * 100)}%</span>`);
    if (s.mode === 'any' || s.mode === 'science') { const best = Math.max(0, ...(pr.rockets || []).map((r) => r.stage || 0), ...s.kingdoms.map((k) => k.stage || 0)); bits.push(`<span class="kt-prog" title="Best rocket">🚀 ${best}/3</span>`); }
    const top = `<span class="kt-clock${s.timeLeft <= 180000 ? ' final' : ''}">⏳ <b id="kt-time">${mmss(s.timeLeft)}</b></span><span class="kt-mode">${mi} ${esc(ml)}</span>${s.peaceIn > 0 ? `<span class="kt-peace">🛡️ Beginner's peace <b id="kt-peace">${mmss(s.peaceIn)}</b></span>` : ''}`;
    const tEl = kv.el.querySelector('#kt-top');
    if (tEl.dataset.html !== top) { tEl.innerHTML = top; tEl.dataset.html = top; }
    // event banner
    const ev = s.events && s.events.current, eEl = kv.el.querySelector('#kt-event');
    eEl.hidden = !ev;
    if (ev) { const h = `<span class="ic">${esc(ev.icon)}</span><div><b>${esc(ev.name)}</b><div>${esc(ev.text)}</div></div>`; if (eEl.dataset.html !== h) { eEl.innerHTML = h; eEl.dataset.html = h; } }
    // kingdom list (top 10 for big games)
    const ks = s.kingdoms.slice().sort((a, b) => b.score - a.score), big = ks.length > 12, shown = big ? ks.slice(0, 10) : ks;
    const allies = new Map((s.alliances || []).map((A2) => [A2.id, A2]));
    const atWar = new Set(); for (const w of s.wars || []) if (w.ago < 60000) { atWar.add(w.a); atWar.add(w.b); }
    const list = `<div class="kt-lh">👑 Kingdoms${big ? ` <small>top 10 of ${ks.length}</small>` : ''}</div>${shown.map((k, i) => `<div class="kt-row${k.gone ? ' gone' : ''}"><span class="n">${i + 1}</span><i class="sw" style="background:${esc(k.color)}"></i><span class="nm">${k.avatar ? esc(k.avatar) + ' ' : ''}${esc(short(kname(k), 15))}</span><span class="tags">${atWar.has(k.id) ? '⚔️' : ''}${k.marked ? '🎯' : ''}${k.bounty ? '💰' : ''}${k.ally && allies.has(k.ally) ? `<em class="al" style="background:${A().allyColor(k.ally)}">🤝</em>` : ''}${k.vassalOf ? '⛓️' : ''}${k.traitor ? '🗡️' : ''}${k.stage ? '🚀' + k.stage : ''}</span><span class="ag" title="${AGE_NAME[k.age]}">${AGE_ICON[k.age] || ''}</span><b>${k.score}</b></div>`).join('')}`;
    const lEl = kv.el.querySelector('#kt-list');
    if (lEl.dataset.html !== list) { lEl.innerHTML = list; lEl.dataset.html = list; }
    sidePanels(s, pr);
    // news ticker: last 4, fading with age
    const T = tnow();
    for (const it of s.ticker || []) if (!kv.tickSeen.has(it.id)) kv.tickSeen.set(it.id, T);
    if (kv.tickSeen.size > 80) for (const id of [...kv.tickSeen.keys()].slice(0, 40)) kv.tickSeen.delete(id);
    const items = [], seenText = new Set(); // newest 4, without repeats of the same line
    for (const it of (s.ticker || []).slice().reverse()) { if (seenText.has(it.text)) continue; seenText.add(it.text); items.unshift(it); if (items.length >= 4) break; }
    const tk = items.map((it) => `<div class="kt-n ${esc(it.kind)}" data-t="${it.id}">${esc(it.text)}</div>`).join('');
    const kEl = kv.el.querySelector('#kt-ticker');
    if (kEl.dataset.html !== tk) { kEl.innerHTML = tk; kEl.dataset.html = tk; }
  }
  // ---------- the right-hand column: council vote, threats, the race to victory ----------
  const setHtml = (el, h) => { if (el && el.dataset.html !== h) { el.innerHTML = h; el.dataset.html = h; } };
  const bar = (pct, col, label) => `<div class="kt-bar"><i style="width:${Math.round(clamp(pct, 0, 1) * 100)}%;background:${esc(col)}"></i><span>${label}</span></div>`;
  function sidePanels(s, pr) {
    const C = s.council, cEl = kv.el.querySelector('#kt-council');
    cEl.hidden = !C;
    if (C) {
      const max = Math.max(1, ...(C.tally || []).map((t) => t.n));
      setHtml(cEl, `<div class="kt-ch">🗳️ Royal Council <b class="kt-cd" data-left="${C.endsIn}">${mmss(C.endsIn)}</b></div><div class="kt-ask">${esc(C.icon)} ${esc(C.ask)}</div><div class="kt-csub">${esc(C.text)} Vote on your phone!</div>
        ${(C.tally || []).slice(0, 4).map((t) => { const k = kv.kById.get(t.id); return k ? `<div class="kt-vrow"><i class="sw" style="background:${esc(k.color)}"></i><span class="nm">${esc(short(kname(k), 14))}</span><span class="kt-vbar"><i style="width:${Math.round(100 * t.n / max)}%"></i></span><b>${t.n}</b></div>` : ''; }).join('')}<div class="kt-csub">${C.votes} of ${C.of} have voted</div>`);
    }
    // threats: attacks on capitals and villages, soonest first
    const now = gameNow(), th = [];
    for (const a of s.armies || []) {
      if (a.order !== 'attack') continue;
      const T = kv.tileAt.get(a.to.q + ',' + a.to.r); if (!T || !T.o || !(T.c || T.v)) continue;
      th.push({ a, T, left: a.t1 - now });
    }
    th.sort((x, y) => (y.T.c ? 1 : 0) - (x.T.c ? 1 : 0) || x.left - y.left);
    const tEl = kv.el.querySelector('#kt-threats'); tEl.hidden = !th.length;
    setHtml(tEl, `<div class="kt-ch">⚔️ Under attack</div>${th.slice(0, 4).map(({ a, T }) => { const att = a.o ? kv.kById.get(a.o) : null, def = kv.kById.get(T.o); return `<div class="kt-trow"><i class="sw" style="background:${esc(att ? att.color : '#222')}"></i><span class="nm">${esc(att ? short(kname(att), 10) : 'Bandits')} <em>→</em> ${esc(def ? short(kname(def), 10) : '?')}${T.c ? ' 🏰' : ' 🏠'}</span><span class="n">${a.n}</span><b class="kt-cd" data-t1="${a.t1}"></b></div>`; }).join('')}${th.length > 4 ? `<div class="kt-csub">+${th.length - 4} more armies on the march</div>` : ''}`);
    // the race: each open win mode with its leader
    const rows = [], mode = s.mode;
    if (mode === 'any' || mode === 'conquest') { const L = pr.leader && kv.kById.get(pr.leader); rows.push(`<div class="kt-rl">⚔️ Conquest <small>${L ? esc(short(kname(L), 12)) : 'nobody yet'}</small></div>${bar(pr.domination || 0, L ? L.color : '#888', `${pr.capitals || 0}/${pr.of || 0} capitals`)}`); }
    if (mode === 'any' || mode === 'diplomacy') rows.push(`<div class="kt-rl">🕊️ Peace Monument <small>${pr.peaceIn != null ? 'PEACE HOLDS' : ''}</small></div>${bar(pr.monument || 0, '#8fd3ff', pr.peaceIn != null ? `peace in <b id="kt-peacehold">${mmss(pr.peaceIn)}</b>` : `${Math.round((pr.monument || 0) * 100)}%`)}`);
    if (mode === 'any' || mode === 'science') {
      const rk = (pr.rockets || []).map((r) => ({ ...r, v: r.stage + (r.building ? 1 - (r.endsIn || 0) / Math.max(1, r.dur || 60000) : 0) })).sort((a, b) => b.v - a.v)[0];
      const K = rk && kv.kById.get(rk.id);
      rows.push(`<div class="kt-rl">🚀 Rocket <small>${K ? esc(short(kname(K), 12)) : 'no launch pad yet'}</small></div>${bar(rk ? rk.v / 3 : 0, K ? K.color : '#888', rk ? `stage ${rk.stage}/3${rk.building ? ' · building ' + rk.building : ''}` : '0/3')}`);
    }
    const ks = s.kingdoms.slice().sort((a, b) => b.score - a.score);
    if (ks.length > 1) rows.push(`<div class="kt-rl">⭐ Score <small>if time runs out</small></div>${bar(1, ks[0].color, `${esc(short(kname(ks[0]), 12))} ${ks[0].score}${ks[1] ? ' · next ' + ks[1].score : ''}`)}`);
    setHtml(kv.el.querySelector('#kt-race'), `<div class="kt-ch">🏆 The race</div>${rows.join('')}`);
  }
  // per-frame bits: clocks and ticker fade
  function tickHud() {
    const s = kv.s; if (!s || !kv.el) return;
    const dt = performance.now() - kv.recvAt;
    const tm = kv.el.querySelector('#kt-time'); if (tm && s.phase === 'play') { const v = mmss(Math.max(0, s.timeLeft - dt)); if (tm.textContent !== v) tm.textContent = v; }
    const pc = kv.el.querySelector('#kt-peace'); if (pc) { const v = mmss(Math.max(0, s.peaceIn - dt)); if (pc.textContent !== v) pc.textContent = v; }
    const ph = kv.el.querySelector('#kt-peacehold'); if (ph && s.progress && s.progress.peaceIn != null) { const v = mmss(Math.max(0, s.progress.peaceIn - dt)); if (ph.textContent !== v) ph.textContent = v; }
    for (const el of kv.el.querySelectorAll('.kt-cd[data-left]')) { const v = mmss(Math.max(0, Number(el.dataset.left) - dt)); if (el.textContent !== v) el.textContent = v; }
    const gn = gameNow(); for (const el of kv.el.querySelectorAll('.kt-cd[data-t1]')) { const v = mmss(Math.max(0, Number(el.dataset.t1) - gn)); if (el.textContent !== v) el.textContent = v; }
    const T = tnow();
    for (const n of kv.el.querySelectorAll('.kt-n')) { const at = kv.tickSeen.get(Number(n.dataset.t)) || T, age = T - at; const o = age < 12 ? 1 : Math.max(0, 1 - (age - 12) / 6); const v = o.toFixed(2); if (n.style.opacity !== v) n.style.opacity = v; }
  }
  // big moments: a ribbon across the middle for a few seconds
  function moment(icon, text, cls = '') {
    const box = kv.el && kv.el.querySelector('#kt-moments'); if (!box) return;
    const d = document.createElement('div'); d.className = 'kt-moment ' + cls; d.innerHTML = `<span class="ic">${icon}</span><span>${esc(text)}</span>`;
    box.appendChild(d); while (box.children.length > 2) box.firstChild.remove();
    setTimeout(() => d.remove(), 4200);
  }

  // ---------- game over ----------
  function overHud(s) {
    const hud = kv.el.querySelector('#kt-hud');
    const w = s.winner || { mode: 'score', ids: [], names: [] }, [wi, wt, wd] = WIN[w.mode] || WIN.score;
    const sig = JSON.stringify([w, s.standings && s.standings.length, s.awards && s.awards.length]);
    if (kv.mode === 'over' && hud.dataset.sig === sig) return;
    kv.mode = 'over'; hud.dataset.sig = sig; hud.dataset.html = '';
    const many = (w.names || []).length > 1;
    const names = (w.names || []).map((n) => esc(many ? String(n).replace(/'s Kingdom$/, '') : String(n)));
    const who = names.length > 4 ? `${names.slice(0, 4).join(', ')} and ${names.length - 4} more` : names.length > 1 ? `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}` : names.join('');
    const st = (s.standings || []).slice(0, 10);
    hud.innerHTML = `<div class="kt-over"><div class="kt-over-card">
      <canvas class="kt-over-cv" id="kt-over-cv"></canvas>
      <div class="kt-over-mode">${wi} ${esc(wt)}</div>
      <h2 class="kt-over-who${many ? ' many' : ''}">${who || 'Nobody'}</h2>
      <p class="kt-over-why">${w.ids && w.ids.length > 1 && w.mode !== 'diplomacy' ? 'together ' : ''}${esc(wd)}${w.reason === 'time' ? ' when time ran out' : '!'}</p>
      <div class="kt-over-grid">
        <div class="kt-stand"><div class="kt-lh">Final standings</div>${st.map((r) => `<div class="kt-row ${w.ids && w.ids.includes(r.id) ? 'win' : ''}"><span class="n">${r.rank}</span><i class="sw" style="background:${esc(r.color)}"></i><span class="nm">${esc(short(kname(r), 20))}</span><span class="tags">${r.vassalOf ? '⛓️' : ''}${r.stage ? '🚀' + r.stage : ''}${r.capitals > 1 ? '🏰' + r.capitals : ''}</span><span class="ag">${AGE_ICON[r.age] || ''}</span><b>${r.score}</b></div>`).join('')}</div>
        <div class="kt-awards">${(s.awards || []).slice(0, 6).map((a) => `<div class="kt-award"><div class="t">${esc(a.title)}</div><div class="w">${esc(kname(a))}</div>${a.value != null ? `<div class="v">${esc(String(a.value))}</div>` : ''}</div>`).join('')}</div>
      </div></div></div>`;
    kv.overAt = tnow();
    const cv = hud.querySelector('#kt-over-cv'), ids = w.ids || [];
    const cols = ids.map((id) => (kv.kById.get(id) || {}).color).filter(Boolean);
    const step = () => {
      if (!document.body.contains(cv)) return;
      const W = cv.clientWidth, H = cv.clientHeight; if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      drawVictory(cv.getContext('2d'), W, H, tnow() - kv.overAt, w.mode, cols.length ? cols : ['#ffd34d']);
      requestAnimationFrame(step);
    };
    step();
  }
  function drawVictory(g, W, H, t, mode, cols) {
    const art = A();
    g.clearRect(0, 0, W, H);
    const cx = W / 2, by = H * 0.92;
    // hills
    g.fillStyle = '#7a9c4c'; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 10) g.lineTo(x, by - 10 + Math.sin(x / 80) * 6); g.lineTo(W, H); g.fill();
    if (mode === 'science') {
      const cyc = t % 7, lift = Math.max(0, cyc - 1.2), y = by - 8 - lift * lift * 16;
      art.drawLaunchPad(g, cx, by - 4, 70, 0, false, t);
      art.flag(g, cx - 70, by - 6, 54, cols[0], t, 1.1);
      for (let i = 0; i < 16; i++) { const yy = Math.min(by, y + 20 + i * 12); g.fillStyle = `rgba(240,240,240,${0.6 - i * 0.035})`; g.beginPath(); g.arc(cx + Math.sin(i * 1.7 + t) * 8, yy, 8 + i * 2, 0, Math.PI * 2); g.fill(); }
      if (y > -120) art.drawRocket(g, cx, y, 110, 3, t, lift > 0 || cyc > 0.8, false);
      if (y < H * 0.2) { for (let i = 0; i < 30; i++) { const a = i * 0.7 + t, r = ((t * 60 + i * 23) % 200); g.fillStyle = `hsla(${i * 40},90%,65%,${1 - r / 200})`; g.beginPath(); g.arc(cx + Math.cos(a) * r, H * 0.35 + Math.sin(a) * r * 0.6, 3, 0, Math.PI * 2); g.fill(); } }
    } else if (mode === 'diplomacy') {
      art.drawMonument(g, cx, by - 4, 105, 1, t);
      for (let i = 0; i < 6; i++) { const u = ((t * 0.25 + i / 6) % 1), x = cx + Math.sin(u * 6 + i) * W * 0.3, y = by - u * H * 0.9; g.globalAlpha = 1 - u; g.font = '30px serif'; g.textAlign = 'center'; g.fillText('🕊️', x, y); g.globalAlpha = 1; }
      cols.slice(0, 10).forEach((c, i) => { const side = i % 2 ? 1 : -1, j = Math.floor(i / 2); art.flag(g, cx + side * (110 + j * 58) - (side < 0 ? 36 : 0), by - 6 + Math.sin((cx + side * (110 + j * 58)) / 80) * 6, 52, c, t + i); });
    } else {
      art.drawCastle(g, cx, by - 12, 48, 5, cols[0], 3, t);
      cols.slice(1, 5).forEach((c, i) => art.flag(g, cx + (i % 2 ? 1 : -1) * (130 + Math.floor(i / 2) * 50), by - 6, 54, c, t + i));
      g.font = `${Math.round(64 + Math.sin(t * 2) * 4)}px serif`; g.textAlign = 'center';
      for (const d of [-1, 1]) g.fillText('👑', cx + d * W * 0.22, H * 0.42 + Math.sin(t * 2 + d) * 8);
      for (let i = 0; i < 24; i++) { const u = ((t * 0.3 + i / 24) % 1); g.fillStyle = `hsla(${45 + i * 9},90%,60%,${1 - u})`; g.fillRect(W * ((i * 0.37) % 1), u * H, 5, 8); }
    }
  }

  // ---------- the game object ----------
  Object.assign(BOX.games.kingdoms = BOX.games.kingdoms || {}, {
    standalone: true, title: titleScreen,
    name: 'JustKingdoms', icon: '🏰',
    about: 'Everyone rules a kingdom on one shared world map. Gather, build and climb five ages from a hamlet to a mighty kingdom, then conquer, make peace, or launch a rocket.',
    how: [
      'Pick your chair at the Round Table on your phone: the people beside you become your neighbours on the map.',
      'Put your peasants to work (farm, chop, quarry, mine, study) and build up your capital.',
      'Upgrade your castle through five ages, from 🛖 Hamlet to 👑 Kingdom, to unlock new buildings, units and research.',
      'Send Settlers to found villages, train an army, and march on your rivals (capitals are safe for the first 5 minutes).',
      'Talk at the table! Make alliances, send gifts, trade, or betray your friends at the worst moment.',
      'Win by ⚔️ conquest, 🕊️ a Peace Monument built by everyone, or 🚀 launching a rocket. Otherwise the best Kingdom Score wins.',
    ],
    fx: { seat: 'pop', age: 'swell', village: 'chime', capture: 'boom', vassal: 'gavel', rebel: 'roar', alliance: 'bell', betray: 'stab', gift: 'chime', message: 'talk', event: 'bell', rocket: 'reveal', launchpad: 'reveal', launch: 'explosion', monument: 'chime', kingdom: 'join', win: 'win', council: 'bell', councilResult: 'gavel', coalition: 'roar', bounty: 'reveal', bountyClaim: 'chime', peacehold: 'swell', peacebroken: 'stab', final: 'reveal' },
    onFx(f) {
      const s = kv.s, T = tnow();
      // the engine passes the kingdom id as `id`; if the room keeps its own sequence id there, use `k`
      const kid = f.k || f.who || (typeof f.id === 'string' ? f.id : null), k = kid && kv.kById.get(kid), n = k ? kname(k) : '';
      switch (f.kind) {
        case 'seat': if (Number.isInteger(f.seat)) kv.pops[f.seat] = T; break;
        case 'battle': if (T - kv.lastBattleSnd > 1.2) { kv.lastBattleSnd = T; BOX.sfx('hit'); } break;
        case 'capture': kv.bursts.push({ kind: 'capture', q: f.q, r: f.r, at: T, dur: 1.6, color: k ? k.color : null }); break;
        case 'village': if (f.q != null) kv.bursts.push({ kind: 'village', q: f.q, r: f.r, at: T, dur: 1.2 }); break;
        case 'age': if (k) { kv.bursts.push({ kind: 'age', q: k.home.q, r: k.home.r, at: T, dur: 2.4 }); if (f.first && f.age >= 3) moment('🥇', `${n} is the first ${AGE_NAME[f.age]}!`); else if (f.age >= 4) moment(AGE_ICON[f.age], `${n} became a ${AGE_NAME[f.age]}!`); } break;
        case 'council': moment('🗳️', 'The Royal Council meets! Vote on your phone', 'diplo'); break;
        case 'councilResult': if (k) moment(f.kind === 'sanction' ? '⚖️' : '🏅', f.kind === 'sanction' ? `The council sanctions ${n}!` : `The royal treasury goes to ${n}!`, f.kind === 'sanction' ? 'war' : 'win'); break;
        case 'coalition': if (k) moment('🎯', `The world unites against ${n}!`, 'war'); break;
        case 'bounty': { const on = kv.kById.get(f.on); if (on) moment('💰', `${f.gold} gold on ${kname(on)}'s head!`, 'war'); break; }
        case 'bountyClaim': if (k) moment('💰', `${n} claims the bounty!`, 'war'); break;
        case 'peacehold': moment('🕊️', 'One world alliance! If the peace holds, everyone wins', 'diplo'); break;
        case 'peacebroken': moment('💔', 'The peace is broken!', 'war'); break;
        case 'final': moment('⏳', 'Final 3 minutes!', 'win'); break;
        case 'gift': { const to = kv.kById.get(f.to); if (to) kv.bursts.push({ kind: 'gift', q: to.home.q, r: to.home.r, at: T, dur: 2 }); break; }
        case 'vassal': { const by = kv.kById.get(f.by); if (k && by) moment('⛓️', `${n} bows to ${kname(by)}!`, 'war'); break; }
        case 'rebel': if (k) moment('✊', f.ok ? `${n} broke free!` : `${n}'s rebellion failed!`, 'war'); break;
        case 'betray': if (k) moment('🗡️', `${n} betrayed their allies!`, 'war'); break;
        case 'alliance': { const a = kv.kById.get(f.a), b = kv.kById.get(f.b); if (a && b && s && s.kingdoms.length <= 20) moment('🤝', `${kname(a)} and ${kname(b)} are allies`, 'diplo'); break; }
        case 'launch': if (k) { kv.flights.push({ id: k.id, at: T }); moment('🚀', `${n} launched the rocket!`, 'win'); } break;
        case 'rocket': if (k && f.stage >= 1 && !f.building) moment('🚀', `${n} finished rocket stage ${f.stage}!`); break;
        case 'monument': if (f.done) moment('🕊️', 'The Peace Monument is complete!', 'win'); break;
        default:
      }
    },
    tv(el, s) {
      if (!s) return;
      ensure(el);
      kv.s = s; kv.recvAt = performance.now();
      kv.kById = new Map((s.kingdoms || []).map((k) => [k.id, k]));
      kv.tileAt = new Map(((s.world && s.world.tiles) || []).map((T) => [T.q + ',' + T.r, T]));
      document.body.classList.toggle('kt-lobby', s.phase === 'lobby');
      if (s.phase === 'lobby') { kv.mode = 'lobby'; lobbyHud(s); return; }
      if (s.phase === 'over') { overHud(s); return; }
      playHud(s);
    },
  });
})();
