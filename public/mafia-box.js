'use strict';
// JustMafia on the big screen, as part of JustGameBox:
//  - the title screen's night scene (Mafia Town after dark, in the town's own pixel colours);
//  - "🎮 Play another game": a picker of the box games; the server (mafia-bridge.js) makes the
//    box room and sends the TV and every phone there, joined with their names;
//  - "🎉 Back to the party" when this town came from a box room (Party Mode counts down and
//    goes back by itself), with the result carried over as party points.
(function () {
  const $ = (s) => document.querySelector(s);
  const H = window.MT_HOST; if (!H) return;
  const socket = H.socket;

  // ---------- title screen: the town at night ----------
  // Drawn at a low resolution and scaled up (crisp pixels), like the town itself.
  const NIGHT = [22, 18, 48];
  const mix = (hex, k) => { const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255]; return `rgb(${c.map((v, i) => Math.round(v * (1 - k) + NIGHT[i] * k)).join(',')})`; };
  const WALLS = ['#f4e1c1', '#f7d6d0', '#dbe8f5', '#e3f0d3', '#f3e6b3', '#e8d9f0', '#fbe3c8'];
  const ROOFS = ['#c0392b', '#2e86de', '#8e44ad', '#d35400', '#16a085', '#7f5539', '#34495e', '#b03a6f'];
  function titleArt() {
    const cv = $('#title-art'); if (!cv) return;
    const g = cv.getContext('2d');
    let W = 0, Hh = 0, scene = null;
    const PX = 4;
    function build() {
      let s = 1234567; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      const ground = Math.round(Hh * 0.8);
      const stars = Array.from({ length: Math.round(W * Hh / 260) }, () => ({ x: Math.floor(rnd() * W), y: Math.floor(rnd() * ground * 0.8), p: rnd() * 6.28, b: rnd() < 0.15 }));
      const houses = []; let x = -6;
      while (x < W + 10) {
        const w = 22 + Math.floor(rnd() * 14), h = 16 + Math.floor(rnd() * 12);
        houses.push({ x, w, h, wall: mix(WALLS[Math.floor(rnd() * WALLS.length)], 0.62), roof: mix(ROOFS[Math.floor(rnd() * ROOFS.length)], 0.5), win: Array.from({ length: 2 }, () => ({ on: rnd() < 0.7, t: rnd() * 20, f: 6 + rnd() * 14 })), tree: rnd() < 0.55, tx: Math.floor(rnd() * 6) });
        x += w + 8 + Math.floor(rnd() * 12);
      }
      const hills = Array.from({ length: Math.ceil(W / 6) + 2 }, (_, i) => Math.round(ground - 14 - 10 * Math.sin(i * 0.35 + 1) - 6 * Math.sin(i * 0.9)));
      return { ground, stars, houses, hills, lamp: Math.round(W * 0.22) };
    }
    function pine(x, y, h, c) { g.fillStyle = c; for (let i = 0; i < h; i++) { const w = Math.max(1, Math.round((i / h) * h * 0.45)); g.fillRect(x - w, y - h + i, w * 2 + 1, 1); } g.fillStyle = '#1a120c'; g.fillRect(x, y, 1, 2); }
    function frame(t) {
      if ($('#title').hidden) { requestAnimationFrame(frame); return; }
      const w = Math.ceil(cv.clientWidth / PX), h = Math.ceil(cv.clientHeight / PX);
      if (w !== W || h !== Hh) { W = w; Hh = h; cv.width = W; cv.height = Hh; scene = build(); }
      const S = scene, sec = t / 1000, G = S.ground;
      // Sky
      const sky = g.createLinearGradient(0, 0, 0, G); sky.addColorStop(0, '#0b0a1c'); sky.addColorStop(0.6, '#241b40'); sky.addColorStop(1, '#4a2b4e');
      g.fillStyle = sky; g.fillRect(0, 0, W, G);
      for (const st of S.stars) { const a = 0.45 + 0.55 * Math.sin(sec * 1.7 + st.p); g.fillStyle = `rgba(255,246,214,${a.toFixed(2)})`; g.fillRect(st.x, st.y, 1, 1); if (st.b && a > 0.85) { g.fillStyle = 'rgba(255,246,214,.35)'; g.fillRect(st.x - 1, st.y, 3, 1); g.fillRect(st.x, st.y - 1, 1, 3); } }
      // Moon with a soft halo, and a cloud drifting across it
      const mx = Math.round(W * 0.8), my = Math.round(G * 0.26), mr = Math.max(8, Math.round(Hh * 0.08));
      for (let r = mr * 2.4; r > mr; r -= 2) { g.fillStyle = `rgba(255,236,170,${(0.05 * (1 - (r - mr) / (mr * 1.4))).toFixed(3)})`; g.beginPath(); g.arc(mx, my, r, 0, 6.29); g.fill(); }
      g.fillStyle = '#f6e7b0'; g.beginPath(); g.arc(mx, my, mr, 0, 6.29); g.fill();
      g.fillStyle = '#ddc98e'; for (const [dx, dy, r] of [[-0.3, -0.2, 0.22], [0.25, 0.15, 0.16], [-0.05, 0.4, 0.12]]) { g.beginPath(); g.arc(mx + dx * mr, my + dy * mr, r * mr, 0, 6.29); g.fill(); }
      const cx = ((sec * 3) % (W + 60)) - 30;
      g.fillStyle = 'rgba(40,30,70,.85)'; g.fillRect(Math.round(cx), my + Math.round(mr * 0.35), 26, 3); g.fillRect(Math.round(cx) + 5, my + Math.round(mr * 0.35) - 2, 14, 2);
      // Hills and the tree line far away
      g.fillStyle = '#1b1631'; S.hills.forEach((y, i) => g.fillRect(i * 6, y, 6, G - y + 1));
      for (let i = 0; i < W; i += 7) pine(i + ((i * 13) % 5), G - 8 - ((i * 7) % 5), 10 + ((i * 11) % 6), '#141d22');
      // Ground and the road
      g.fillStyle = '#1d2a1c'; g.fillRect(0, G, W, Hh - G);
      g.fillStyle = '#3b3122'; g.fillRect(0, G + 7, W, 5); g.fillStyle = '#4a3d2a'; g.fillRect(0, G + 7, W, 1);
      // The houses: lit windows flicker on and off as the town goes to bed
      for (const hs of S.houses) {
        const y = G + 2, top = y - hs.h;
        if (hs.tree) pine(hs.x - 4 + hs.tx, y, 14 + hs.tx, '#17271a');
        g.fillStyle = hs.wall; g.fillRect(hs.x, top, hs.w, hs.h);
        g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(hs.x + hs.w - 3, top, 3, hs.h);
        g.fillStyle = hs.roof; const rh = Math.round(hs.w * 0.42);
        for (let i = 0; i < rh; i++) { const inset = Math.round((i / rh) * (hs.w / 2 + 2)); g.fillRect(hs.x - 2 + inset, top - i, hs.w + 4 - inset * 2, 1); }
        g.fillStyle = '#2a1a12'; g.fillRect(hs.x + Math.round(hs.w / 2) - 2, y - 7, 5, 7);
        hs.win.forEach((wn, i) => {
          const on = wn.on ? Math.sin(sec / wn.f * 6.28 + wn.t) > -0.85 : Math.sin(sec / wn.f * 6.28 + wn.t) > 0.92;
          const wx = hs.x + (i ? hs.w - 8 : 3), wy = top + 4;
          if (on) { g.fillStyle = 'rgba(255,200,90,.18)'; g.fillRect(wx - 2, wy - 2, 9, 9); }
          g.fillStyle = on ? '#ffd76b' : '#2b2440'; g.fillRect(wx, wy, 5, 5);
          g.fillStyle = on ? '#e3a944' : '#1d1830'; g.fillRect(wx + 2, wy, 1, 5); g.fillRect(wx, wy + 2, 5, 1);
        });
      }
      // A street lamp
      const lx = S.lamp, ly = G + 6;
      g.fillStyle = 'rgba(255,220,130,.10)'; g.beginPath(); g.moveTo(lx, ly - 24); g.lineTo(lx - 14, ly + 6); g.lineTo(lx + 15, ly + 6); g.fill();
      g.fillStyle = '#2b2b33'; g.fillRect(lx, ly - 24, 2, 26); g.fillRect(lx - 2, ly - 26, 6, 2);
      g.fillStyle = '#ffe9a8'; g.fillRect(lx - 1, ly - 24, 4, 3);
      // Someone walks the street at night… (eyes glint red; a knife catches the moon)
      const period = 26, ph = (sec % period) / period, fx = Math.round(-10 + ph * (W + 20)), fy = G + 10;
      if (ph < 0.98) {
        const bob = Math.round(Math.sin(sec * 8) * 0.6);
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(fx - 3, fy + 1, 9, 1);
        g.fillStyle = '#0a0812'; g.fillRect(fx - 2, fy - 12 + bob, 6, 12); g.fillRect(fx - 1, fy - 16 + bob, 5, 5); g.fillRect(fx - 2, fy - 15 + bob, 1, 3);
        g.fillRect(fx + (Math.sin(sec * 8) > 0 ? -1 : 2), fy, 2, 1);
        g.fillStyle = '#ff3b3b'; g.fillRect(fx + 2, fy - 14 + bob, 1, 1);
        if (Math.sin(sec * 2.3) > 0.6) { g.fillStyle = '#e9edf5'; g.fillRect(fx + 4, fy - 7 + bob, 1, 3); g.fillStyle = '#fff'; g.fillRect(fx + 4, fy - 8 + bob, 1, 1); }
      }
      // Fog drifting along the ground
      for (let i = 0; i < 3; i++) { const fx2 = ((sec * (4 + i * 2) + i * 90) % (W + 120)) - 60; g.fillStyle = 'rgba(180,170,220,.07)'; g.fillRect(Math.round(fx2), G + 2 + i * 4, 70 + i * 20, 3); }
      g.fillStyle = 'rgba(8,6,16,.35)'; g.fillRect(0, Hh - 3, W, 3);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  titleArt();

  // ---------- the JustGameBox games ----------
  const GAMES = [
    ['president', '👑', 'President'], ['blanks', '🃏', 'JustBlanks'], ['blackjack', '🃏', 'Blackjack Night'], ['bid', '🚪', 'JustBid'],
    ['price', '🏷️', 'Price Panic'], ['emoji', '🤔', 'Emoji Charades'], ['truths', '🤥', 'Two Truths & a Lie'], ['likely', '👑', 'Most Likely To…'],
    ['whosaid', '🗣️', 'Who Said It?'], ['spectrum', '🧭', 'Where Do You Stand?'], ['sketch', '🎨', 'JustSketch Relay'], ['funny', '😂', 'JustFunny'],
    ['zombie', '🧟', 'Zombie Survival'], ['ducks', '🦆', 'JustRaiseDucks', true], ['kingdoms', '🏰', 'JustKingdoms', true],
  ];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const U = window.UNLOCKS;
  const locked = (k) => !!(U && U.isLockable(k) && !U.has(k));
  let link = null; // { box, party, game, over, results, returnAt, now } when this town came from a box room

  function picker() {
    let o = $('#mt-pick'); if (o) o.remove();
    o = document.createElement('div'); o.id = 'mt-pick'; o.className = 'mt-pick';
    o.innerHTML = `<div class="panel"><h2>🎮 Play another game</h2><p>${link ? 'Everyone goes back to the party room for it. Party points carry on.' : 'Everyone moves over together: phones join by themselves, with the same names.'}</p>
      <div class="games">${GAMES.map(([k, ic, n, big]) => { const lk = locked(k); return `<button data-game="${k}" class="${big ? 'big-g' : ''}" ${lk ? 'disabled' : ''}><span>${lk ? '🔒' : ic}</span>${esc(n)}${lk ? `<small>${esc((U.LIST[k] || {}).how || 'Locked')}</small>` : ''}</button>`; }).join('')}</div>
      <button class="btn" data-close>Cancel</button></div>`;
    document.body.appendChild(o);
    o.addEventListener('click', (e) => { if (e.target === o || e.target.closest('[data-close]')) o.remove(); });
    for (const b of o.querySelectorAll('[data-game]')) b.addEventListener('click', () => {
      o.remove();
      socket.emit('host:toBox', { game: b.dataset.game, unlocks: U ? U.all() : [] }, (r) => { if (!r || !r.ok) H.toast((r && r.error) || 'Could not open that game.'); });
    });
    const first = o.querySelector('[data-game]:not(:disabled)'); if (first) first.focus();
  }
  const goParty = () => socket.emit('host:boxBack', {}, (r) => { if (!r || !r.ok) H.toast((r && r.error) || 'Could not go back to the party.'); });
  $('#go-pick').addEventListener('click', picker);
  $('#lobby-pick').addEventListener('click', picker);
  $('#go-party').addEventListener('click', goParty);
  $('#lobby-party').addEventListener('click', goParty);

  // ---------- back to the party ----------
  let skew = 0;
  function renderLink() {
    $('#go-party').hidden = !link; $('#lobby-party').hidden = !link;
    let bar = $('#party-back');
    if (!link || !link.returnAt) { if (bar) bar.remove(); return; }
    if (!bar) {
      bar = document.createElement('div'); bar.id = 'party-back'; bar.className = 'party-back';
      bar.innerHTML = '<span>🎉 Back to the party in <b id="pb-left"></b>s</span><button class="btn" id="pb-now">Go now ▶</button>';
      document.body.appendChild(bar);
      bar.querySelector('#pb-now').addEventListener('click', goParty);
    }
    tick();
  }
  function tick() { const el = $('#pb-left'); if (el && link && link.returnAt) el.textContent = Math.max(0, Math.ceil((link.returnAt - (Date.now() + skew)) / 1000)); }
  setInterval(tick, 250);
  socket.on('host:boxLink', (info) => { link = info || null; if (info && info.now) skew = info.now - Date.now(); renderLink(); });

  // The server moves this screen: remember the box room (so its TV page resumes it), then go.
  socket.on('host:goto', (m) => {
    if (!m || typeof m.url !== 'string' || !/^\/[a-z]/.test(m.url)) return;
    if (m.box && m.box.code) {
      let prev = null; try { prev = JSON.parse(localStorage.getItem('box.host') || 'null'); } catch { /* */ }
      const hostKey = m.box.hostKey || (prev && prev.code === m.box.code ? prev.hostKey : null);
      try { localStorage.setItem('box.host', JSON.stringify({ code: m.box.code, hostKey, game: m.box.game })); } catch { /* private mode */ }
    }
    const v = document.createElement('div'); v.className = 'mt-leaving'; v.textContent = '🎮 Off to the next game…'; document.body.appendChild(v);
    setTimeout(() => { location.href = m.url; }, 400);
  });
})();
