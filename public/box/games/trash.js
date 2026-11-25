'use strict';
// JustZombies: the TV (a big map of the town grid, who is where, the kill feed, the results) and
// the phone (the WHOLE game: a full-screen canvas shooter, public/box/games/trash-sim.js).
// Phone controls: touch = drag anywhere to move (a floating stick appears under your thumb), the
// small stick bottom-right aims and fires (auto-aim shoots the nearest zombie while it's idle);
// keyboard + mouse = WASD / arrows to move, mouse to aim, hold the left button to fire, Esc / P to
// pause, 1 2 3 (or click) for the level-up cards, E grabs a pickup from a little further away.
(function () {
  const { esc, timer } = BOX;
  const W = () => window.TZW;
  const TAU = Math.PI * 2;
  const clip = (f, o) => { try { return !!(window.BOX && BOX.audio && BOX.audio.clip && BOX.audio.clip(f, o)); } catch { return false; } };
  const face = (x, n = 40) => (BOX.face ? BOX.face(x, n, { cls: 'tz-fc' }) : `<span class="tz-emo">${esc((x && x.avatar) || '🙂')}</span>`);
  const abIcons = (list) => (list || []).map((e) => { const id = Array.isArray(e) ? e[0] : e, n = Array.isArray(e) ? e[1] : 0, A = W().AB[id]; return A ? `<span class="tz-abi c-${A.cat}" title="${esc(A.name)}">${A.icon}${n > 1 ? `<sub>${n}</sub>` : ''}</span>` : ''; }).join('');
  const lookOf = (s, x, y) => (s.homes || []).some((h) => h[0] === x && h[1] === y) ? W().HOME : W().biomeOf(s.seed, x, y);
  const nm = (n) => esc(BOX.filterText ? BOX.filterText(n || '') : n || '');

  // ======================================================================= TV
  const TV = { el: null, s: null, raf: 0, anims: [], faces: new Map(), at: 0 };
  function faceImg(p) {
    let im = TV.faces.get(p.id);
    const url = BOX.faceUrl ? BOX.faceUrl({ ...p, bot: true }, 64) : '';
    if (!im || im.dataset.u !== url) { im = new Image(); im.dataset.u = url; if (url) im.src = url; TV.faces.set(p.id, im); }
    return im.complete && im.naturalWidth ? im : null;
  }
  function tvLoop() {
    cancelAnimationFrame(TV.raf);
    const step = () => {
      const c = TV.el && TV.el.querySelector('#tz-map');
      if (!c || !document.body.contains(c)) { TV.raf = 0; return; }
      const wv = c.clientWidth, hv = c.clientHeight, d = Math.min(2, window.devicePixelRatio || 1);
      if (c.width !== Math.round(wv * d) || c.height !== Math.round(hv * d)) { c.width = Math.round(wv * d); c.height = Math.round(hv * d); }
      const g = c.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); drawMap(g, wv, hv, performance.now() / 1000);
      const sc = TV.el.querySelector('#tz-spotc'); if (sc) spotDraw(sc, performance.now() / 1000);
      TV.raf = requestAnimationFrame(step);
    };
    TV.raf = requestAnimationFrame(step);
  }
  function drawMap(g, w, h, t, s0) { // (the TV's map; the phone's town map passes its own state)
    const s = s0 || TV.s; if (!s) return;
    const Z = W(), N = s.grid || Z.GRID, A = window.TZA;
    g.clearRect(0, 0, w, h);
    const cw = Math.min((w - 20) / N, ((h - 20) / N) * (Z.AW / Z.AH)), ch = cw * (Z.AH / Z.AW), x0 = (w - cw * N) / 2, y0 = (h - ch * N) / 2;
    const ex = new Set((s.explored || []).map((e) => e[0] + ',' + e[1]));
    // streets between explored cells
    g.fillStyle = '#141018'; g.fillRect(x0 - 8, y0 - 8, cw * N + 16, ch * N + 16);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const px = x0 + x * cw, py = y0 + y * ch, k = x + ',' + y;
      if (ex.has(k)) {
        const area = Z.genArea(s.seed, x, y, (s.homes || []).some((hh) => hh[0] === x && hh[1] === y));
        const tw = Math.max(16, Math.round(cw)), th = Math.max(10, Math.round(ch));
        if (A) g.drawImage(A.thumb(area, tw, th), px, py, cw + 0.5, ch + 0.5);
        if (cw > 70) { g.font = `bold ${Math.max(10, Math.round(cw * 0.1))}px "Lilita One", sans-serif`; g.textAlign = 'left'; g.textBaseline = 'top'; const label = area.biome.icon + ' ' + area.biome.name; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.strokeText(label, px + 8, py + 7); g.fillStyle = '#fff6d8'; g.fillText(label, px + 8, py + 7); }
      } else {
        // fog of war: the town is still there, just dark (its streets show faintly)
        g.fillStyle = (x + y) % 2 ? '#17141b' : '#141118'; g.fillRect(px, py, cw + 0.5, ch + 0.5);
        roadLines(g, Z, s.seed, x, y, px, py, cw, ch, 'rgba(150,140,170,0.22)');
      }
    }
    // co-op areas glow
    for (const c of s.coop || []) { const [x, y] = c.k.split(',').map(Number); const px = x0 + x * cw, py = y0 + y * ch; g.strokeStyle = `rgba(255,210,63,${0.6 + 0.4 * Math.sin(t * 4)})`; g.lineWidth = 6; g.strokeRect(px + 2, py + 2, cw - 4, ch - 4); g.font = `bold ${Math.max(11, Math.round(cw * 0.1))}px "Lilita One", sans-serif`; g.fillStyle = '#ffd23f'; g.textAlign = 'right'; g.textBaseline = 'bottom'; g.fillText('🤝 CO-OP', px + cw - 8, py + ch - 6); }
    // garage doors rolling up (a run starting)
    TV.anims = TV.anims.filter((a) => t - a.t0 < 4);
    for (const a of TV.anims) {
      const u = (t - a.t0) / 3, px = x0 + a.x * cw, py = y0 + a.y * ch, dw = cw * 0.36, dh = ch * 0.4, dx = px + cw / 2 - dw / 2, dy = py + ch * 0.08;
      g.fillStyle = `rgba(255,240,200,${0.5 * Math.sin(Math.min(1, u) * Math.PI)})`; g.beginPath(); g.moveTo(dx, dy + dh); g.lineTo(dx + dw, dy + dh); g.lineTo(dx + dw + cw * 0.2, py + ch); g.lineTo(dx - cw * 0.2, py + ch); g.closePath(); g.fill();
      const shown = dh * (1 - Math.min(1, Math.max(0, u * 1.4 - 0.2)));
      g.fillStyle = '#c9ccd1'; g.fillRect(dx + Math.sin(t * 50) * (u < 0.8 ? 2 : 0), dy, dw, shown); g.strokeStyle = '#1b1410'; g.lineWidth = 2; g.strokeRect(dx, dy, dw, dh);
    }
    // the roads between blocks (bright where both sides are open), then the locked blocks with their kill counts (every mode)
    const LK = s.locks, open = (x, y) => !LK || !(LK.req[y * N + x] > LK.kills);
    if (LK) {
      g.lineCap = 'round';
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const c = Z.cellOf(s.seed, x, y); if (!c) continue;
        for (const [d, nx, ny] of [['e', x + 1, y], ['s', x, y + 1]]) { if (!c.side[d] || nx >= N || ny >= N) continue; const both = open(x, y) && open(nx, ny), ax = x0 + (x + 0.5) * cw, ay = y0 + (y + 0.5) * ch, bx = x0 + (nx + 0.5) * cw, by = y0 + (ny + 0.5) * ch; g.strokeStyle = both ? 'rgba(156,255,90,0.55)' : 'rgba(255,90,60,0.4)'; g.lineWidth = Math.max(2, cw * 0.035); g.setLineDash(both ? [] : [6, 6]); g.beginPath(); g.moveTo(ax + (bx - ax) * 0.32, ay + (by - ay) * 0.32); g.lineTo(ax + (bx - ax) * 0.68, ay + (by - ay) * 0.68); g.stroke(); }
      }
      g.setLineDash([]);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = y * N + x, need = LK.req[i] || 0, kind = LK.kind && LK.kind[i], px = x0 + x * cw, py = y0 + y * ch;
        if (kind && (!need || need <= LK.kills)) { const ic = (window.TZG && TZG.ICONS[kind]) || '⭐'; g.font = `${Math.max(11, Math.round(ch * 0.2))}px sans-serif`; g.textAlign = 'left'; g.textBaseline = 'bottom'; g.fillText(ic, px + 6, py + ch - 4); }
        if (!need || need <= LK.kills) continue;
        g.fillStyle = kind ? 'rgba(110,70,10,0.55)' : 'rgba(120,20,20,0.42)'; g.fillRect(px + 3, py + 3, cw - 6, ch - 6);
        if (kind) { g.strokeStyle = `rgba(255,210,63,${0.6 + 0.3 * Math.sin(t * 3)})`; g.lineWidth = 3; g.strokeRect(px + 4, py + 4, cw - 8, ch - 8); }
        g.strokeStyle = 'rgba(200,204,209,0.4)'; g.lineWidth = 2; g.setLineDash([8, 6]); g.beginPath(); g.moveTo(px + 6, py + 6); g.lineTo(px + cw - 6, py + ch - 6); g.moveTo(px + cw - 6, py + 6); g.lineTo(px + 6, py + ch - 6); g.stroke(); g.setLineDash([]);
        const fs = Math.max(10, Math.round(Math.min(cw * 0.12, ch * 0.2))); g.font = `bold ${fs}px "Lilita One", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.85)';
        const lbl = `🔒 ${LK.kills} / ${need}`; g.strokeText(lbl, px + cw / 2, py + ch / 2); g.fillStyle = kind ? '#ffe066' : '#ffd23f'; g.fillText(lbl, px + cw / 2, py + ch / 2);
        if (kind && cw > 60) { const ic = (window.TZG && TZG.ICONS[kind]) || '⭐', nm2 = kind === '?' ? 'special' : ((window.TZG && TZG.NAMES[kind]) || '').replace(/^(A|The) /, ''); g.font = `bold ${Math.max(9, fs - 3)}px "Lilita One", sans-serif`; g.strokeText(ic + ' ' + nm2, px + cw / 2, py + ch / 2 + fs * 1.1); g.fillStyle = '#ffe9a8'; g.fillText(ic + ' ' + nm2, px + cw / 2, py + ch / 2 + fs * 1.1); }
        const u = Math.min(1, LK.kills / need), bw = cw * 0.6; g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(px + (cw - bw) / 2, py + ch / 2 - fs * 1.25, bw, Math.max(3, fs * 0.28)); g.fillStyle = u > 0.8 ? '#9cff3c' : '#ffb02e'; g.fillRect(px + (cw - bw) / 2, py + ch / 2 - fs * 1.25, bw * u, Math.max(3, fs * 0.28));
      }
    }
    // Regular mode: the hinted area, the door
    const S0 = s.story;
    if (S0) {
      if (S0.hint) { const [hx, hy] = S0.hint; g.strokeStyle = `rgba(255,90,60,${0.6 + 0.3 * Math.sin(t * 3)})`; g.lineWidth = 4; g.setLineDash([12, 8]); g.beginPath(); g.ellipse(x0 + (hx + 0.5) * cw, y0 + (hy + 0.5) * ch, cw * 1.6, ch * 1.6, 0, 0, TAU); g.stroke(); g.setLineDash([]); }
      if (S0.door) { const [dx2, dy2] = S0.door, px = x0 + dx2 * cw, py = y0 + dy2 * ch, D = (window.TZS.DOORS.find((d) => d.key === S0.doorLook) || {}); g.strokeStyle = `rgba(255,90,60,${0.7 + 0.3 * Math.sin(t * 5)})`; g.lineWidth = 6; g.strokeRect(px + 2, py + 2, cw - 4, ch - 4); g.font = `${Math.round(ch * 0.42)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(S0.doorOpen ? '☠️' : D.icon || '🚪', px + cw / 2, py + ch * 0.45); }
    }
    // places the team found, hidden stashes, call-outs (with the route along the streets)
    const TP = window.TZP;
    for (const [k, type] of s.found || []) { const [fx, fy] = k.split(',').map(Number), Pl = TP && TP.PLACES[type]; if (!Pl) continue; const px = x0 + fx * cw, py = y0 + fy * ch; g.fillStyle = 'rgba(15,10,6,0.78)'; g.beginPath(); g.arc(px + cw * 0.82, py + ch * 0.28, Math.max(10, cw * 0.11), 0, TAU); g.fill(); g.strokeStyle = Pl.color; g.lineWidth = 3; g.stroke(); g.font = `${Math.max(12, Math.round(cw * 0.13))}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(Pl.icon, px + cw * 0.82, py + ch * 0.29); }
    for (const q of s.pings || []) {
      const u = (t * 1.5) % 1, px = x0 + (q.x + 0.5) * cw, py = y0 + (q.y + 0.5) * ch; g.strokeStyle = `rgba(255,210,63,${1 - u})`; g.lineWidth = 5; g.beginPath(); g.arc(px, py, cw * 0.15 + u * cw * 0.4, 0, TAU); g.stroke();
      const who = (s.players || []).find((p) => p.id === q.id); if (who && (who.x !== q.x || who.y !== q.y)) { const path = routeCells(Z, s.seed, [who.x, who.y], [q.x, q.y]); g.strokeStyle = 'rgba(255,210,63,0.75)'; g.lineWidth = 4; g.setLineDash([10, 8]); g.beginPath(); path.forEach(([rx, ry], i) => { const X = x0 + (rx + 0.5) * cw, Y = y0 + (ry + 0.5) * ch; if (i) g.lineTo(X, Y); else g.moveTo(X, Y); }); g.stroke(); g.setLineDash([]); }
    }
    if (TV.flash && t - TV.flash.t0 < 3) { const u = (t - TV.flash.t0) / 3, px = x0 + (TV.flash.x + 0.5) * cw, py = y0 + (TV.flash.y + 0.5) * ch; const gr = g.createRadialGradient(px, py, 2, px, py, cw * (0.5 + u)); gr.addColorStop(0, `rgba(255,230,140,${0.9 * (1 - u)})`); gr.addColorStop(1, 'rgba(255,200,80,0)'); g.fillStyle = gr; g.beginPath(); g.arc(px, py, cw * (0.5 + u), 0, TAU); g.fill(); }
    // players
    const byCell = new Map();
    for (const p of s.players || []) { const k = p.x + ',' + p.y; if (!byCell.has(k)) byCell.set(k, []); byCell.get(k).push(p); }
    for (const [k, L] of byCell) {
      const [x, y] = k.split(',').map(Number), n = L.length, R = Math.max(12, Math.min(cw, ch) * (n > 3 ? 0.17 : 0.24));
      L.forEach((p, i) => {
        const col = n === 1 ? 0 : (i % 3) - (Math.min(n, 3) - 1) / 2, row = Math.floor(i / 3), cx = x0 + x * cw + cw / 2 + col * R * 2.1, cy = y0 + y * ch + ch * 0.56 + row * R * 2.1 - (n > 3 ? R : 0);
        const dead = p.state === 'dead';
        if (p.danger && !dead) { const pu = (t * 2) % 1; g.strokeStyle = `rgba(255,60,40,${1 - pu})`; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, R + 4 + pu * R, 0, TAU); g.stroke(); }
        g.save(); g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fillStyle = dead ? '#444' : '#2a2230'; g.fill(); g.clip();
        const im = faceImg(p);
        if (im) { if (dead) g.filter = 'grayscale(1) brightness(0.6)'; g.drawImage(im, cx - R, cy - R, R * 2, R * 2); g.filter = 'none'; }
        else { g.font = `${Math.round(R * 1.3)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(p.avatar || '🙂', cx, cy + 2); }
        g.restore();
        g.lineWidth = 4; g.strokeStyle = dead ? '#777' : p.color || '#fff'; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke();
        if (dead) { g.font = `${Math.round(R)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('💀', cx + R * 0.7, cy - R * 0.7); }
        else if (p.ch) { g.font = `${Math.round(R * 0.8)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🃏', cx + R * 0.8, cy - R * 0.8); }
        // HP ring
        if (!dead && p.mhp) { g.strokeStyle = p.hp / p.mhp < 0.3 ? '#ff4a3a' : '#7dff6a'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, R + 4, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0, p.hp / p.mhp)); g.stroke(); }
        g.font = `bold ${Math.max(11, Math.round(R * 0.62))}px "Lilita One", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'top';
        const label = (BOX.filterText ? BOX.filterText(p.name) : p.name) + (dead ? '' : ' · W' + p.wave);
        g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.strokeText(label, cx, cy + R + 5); g.fillStyle = '#fff'; g.fillText(label, cx, cy + R + 5);
      });
    }
  }
  // the streets of one cell as lines (fogged TV cells, the phone minimap)
  function roadLines(g, Z, seed, x, y, px, py, cw, ch, col) {
    const c = Z.cellOf(seed, x, y); if (!c) return; const sx = cw / Z.AW, sy = ch / Z.AH, hx = px + c.hub.x * sx, hy = py + c.hub.y * sy;
    g.strokeStyle = col; g.lineCap = 'round'; g.beginPath();
    for (const [d, r] of Object.entries(c.side)) { if (!r) continue; g.lineWidth = Math.max(1, r.w * Math.min(sx, sy) * (cw > 40 ? 0.5 : 0.9)); const ex = d === 'w' ? px : d === 'e' ? px + cw : px + r.p * sx, ey = d === 'n' ? py : d === 's' ? py + ch : py + r.p * sy; g.moveTo(ex, ey); if (d === 'n' || d === 's') { g.lineTo(ex, hy); g.lineTo(hx, hy); } else { g.lineTo(hx, ey); g.lineTo(hx, hy); } }
    g.stroke();
  }
  // the road route between two cells (breadth first along the streets)
  function routeCells(Z, seed, from, to) {
    const d = Z.roadDist(seed, [to]), N = Z.GRID, out = [from.slice()]; let c = from.slice();
    for (let i = 0; i < 40 && (c[0] !== to[0] || c[1] !== to[1]); i++) { const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [c[0] + dx, c[1] + dy]).filter((n) => Z.roadBetween(seed, c, n)).sort((a, b) => d[a[1] * N + a[0]] - d[b[1] * N + b[0]])[0]; if (!nb) break; c = nb; out.push(c); }
    return out;
  }
  function tvSide(s) {
    const ranked = s.mode === 'score' || s.mode === 'garage';
    const P = (s.players || []).slice().sort((a, b) => (ranked ? b.score - a.score : 0) || (a.state === 'dead') - (b.state === 'dead') || b.wave - a.wave || b.kills - a.kills);
    const rows = P.map((p, i) => `<div class="tz-row ${p.state === 'dead' ? 'dead' : ''} ${p.danger ? 'danger' : ''} ${s.spot && s.spot.id === p.id ? 'spot' : ''}"><span class="tz-rank">${i + 1}</span>${face({ ...p, bot: true }, 46)}<div class="tz-rmain"><b style="color:${esc(p.color || '#fff')}">${p.veh && window.TZX ? window.TZX.VEHICLES[p.veh].icon + ' ' : ''}${p.cls && window.TZR ? window.TZR.CLASSES[p.cls].icon + ' ' : ''}${nm(p.name)}</b>
      <small>${p.state === 'dead' ? '💀 out · ' : p.state === 'down' ? '🆘 DOWN · ' : p.ch ? '🃏 picking an ability · ' : p.brk >= 0 ? `<b class="tz-brk-s">⏱ break ${p.brk}s</b> · ` : ''}${s.mode === 'score' || p.score ? `<b class="tz-sc">${(p.score || 0).toLocaleString('en-US')}</b>${p.streak > 1 ? ` <b class="tz-mx">×${p.streak}</b>` : ''} · ` : ''}Wave ${p.wave} · Lv ${p.lvl} · ${p.kills} kills</small>
      <div class="tz-hp"><i style="width:${p.state === 'dead' || !p.mhp ? 0 : Math.round((100 * p.hp) / p.mhp)}%"></i></div><div class="tz-ab">${abIcons(p.ab)}${(p.wp || []).slice(1).map(([id, lv, tier]) => window.TZR && window.TZR.WEAPONS[id] ? `<span class="tz-abi t${tier}" title="${esc(window.TZR.wname(id, tier))}">${window.TZR.WEAPONS[id].icon}<sub>${lv}</sub></span>` : '').join('')}</div></div></div>`).join('');
    const feed = (s.feed || []).slice(-5).reverse().map((f) => `<li>${esc(f.icon)} ${nm(f.text)}</li>`).join('');
    const kfeed = (s.kfeed || []).slice(-5).reverse().map((k) => `<li class="${k.big ? 'big' : ''}"><b style="color:${esc(k.color || '#fff')}">${nm(k.name)}</b> <span>${esc(k.icon)} ${nm(k.text)}</span></li>`).join('');
    const len = s.mode === 'score' ? '🏆 Score attack' : s.mode === 'garage' ? '🏚️ Garage Defense' : { endless: '♾️ Endless', w20: '🏁 First to wave 20' }[s.length] || '';
    const G0 = s.garage, wx = s.weather;
    const chips = `<div class="tz-chips">${wx ? `<span class="tz-chip wx-${esc(wx.k)}" title="${esc(wx.tip)}">${esc(wx.icon)} ${esc(wx.name)}${wx.k !== 'clear' ? `<small>${esc(wx.tip)}</small>` : ''}</span>` : ''}${G0 ? `<span class="tz-chip gd-${esc(G0.phase)}">${G0.phase === 'explore' ? `🏚️ Horde night ${G0.night + 1} at wave ${G0.next}` : G0.phase === 'build' ? `🔨 Night ${G0.night}: building · ${timer(G0.endsIn)}` : `🧟 Night ${G0.night}: THE HORDE · ${timer(G0.endsIn)}`}<small>Hope ${'❤️'.repeat(G0.hope)}${'🖤'.repeat(Math.max(0, G0.max - G0.hope))}</small></span>` : ''}${s.poll ? `<span class="tz-chip vote">🗳️ Helpers vote: ${s.poll.opts.map((k) => (window.TZX ? window.TZX.VOTE_EVENTS[k].icon : '') + ' ' + (s.poll.counts[k] || 0)).join(' · ')}</span>` : ''}${s.helpers ? `<span class="tz-chip help">🙌 ${s.helpers} helper${s.helpers > 1 ? 's' : ''}</span>` : ''}</div>`;
    // the gates (every mode): how much of town is open, the next gate's kills; Regular adds the key, the maps and the door
    const S0 = s.story, LK = s.locks, openN = LK ? LK.req.filter((r) => !(r > LK.kills)).length : 0, nextNeed = LK ? Math.min(...LK.req.filter((r) => r > LK.kills), Infinity) : Infinity;
    const gates = LK ? `<b>🔓 ${openN}/${LK.req.length} blocks open · 🧟 ${LK.kills} team kills</b>${Number.isFinite(nextNeed) ? `<span>🔒 next gate: ${LK.kills} / ${nextNeed} kills</span><i style="width:${Math.round(100 * Math.min(1, LK.kills / nextNeed))}%"></i>` : '<span>Every gate in town is open!</span>'}` : '';
    const storyBox = S0 || LK ? `<div class="tz-story"><div>${gates || '<b>📖 Regular</b>'}</div>${S0 ? `<div class="tz-sk"><span>🗝️ ${S0.keys}/3</span><span>🗺️ ${S0.maps}/2</span><span>${S0.boss ? `${S0.boss.icon} ${esc(S0.boss.name)}${S0.doorOpen ? ' <b>AWAKE</b>' : ''}` : '🚪 door: ???'}</span></div>` : ''}</div>` : '';
    const BK = P.filter((p) => !p.bot && p.state === 'play' && p.brk >= 0).sort((a, b) => a.brk - b.brk)[0];
    const brkBox = BK ? `<div class="tz-break ${BK.brk <= 5 ? 'hot' : ''}"><small>⏱ ${nm(BK.name)}: NEXT WAVE IN</small><b>${BK.brk}</b><span>Shop or walk on: it starts by itself</span></div>` : G0 && G0.phase === 'build' ? `<div class="tz-break build ${G0.endsIn <= 5000 ? 'hot' : ''}"><small>🔨 HORDE NIGHT ${G0.night}: BUILD</small><b>${Math.ceil(G0.endsIn / 1000)}</b><span>The horde comes when it hits zero</span></div>` : '';
    return brkBox + `<div class="tz-sidehead"><span class="tz-logo-s">Just<b>Zombies</b></span>${S0 ? `<span class="tz-len">📖 ${timer(S0.time || 0)}</span>` : s.endsIn ? `<span class="tz-clock">⏱ ${timer(s.endsIn)}</span>` : `<span class="tz-len">${len}</span>`}</div>${storyBox}
      ${chips}<h4 class="tz-lbh">🏆 Leaderboard${ranked ? ' · by score' : ''}</h4><div class="tz-rows">${rows}</div>${kfeed ? `<h4 class="tz-lbh">💀 Kill feed</h4><ul class="tz-kfeed">${kfeed}</ul>` : ''}<ul class="tz-feed">${feed}</ul>`;
  }
  // ---------- the boss intro card and the highlight recap (over the map) ----------
  function tvCards(s) {
    const C = s.card, Rc = s.recap; let html = '';
    if (C) html += `<div class="tz-bcard k-${esc(C.key)}"><div class="tz-bc-i">${esc(C.icon)}</div><div><small>${C.kind === 'final' ? '☠️ FINAL BOSS' : C.kind === 'horde' ? '🌙 HORDE NIGHT' : '⚠️ BOSS INCOMING'}</small><h2>${esc(C.name)}</h2><p>${esc(C.desc || '')}</p>${C.by ? `<em>near ${nm(C.by)}</em>` : ''}</div></div>`;
    else if (Rc && Rc.m) { const M = Rc.m, st = Rc.stats || {}; html += `<div class="tz-recap"><small>${esc(Rc.title)}</small><div class="tz-rc-row">${face({ id: M.id, name: M.name, avatar: M.avatar, bot: true }, 90)}<div><h2 style="color:${esc(M.color || '#ffd23f')}">${nm(M.name)}</h2><p>${nm(M.text)}</p></div><div class="tz-rc-big">${{ multi: '💥 ×' + M.value, boss: '☠️', final: '🏆', streak: '🔥 ×' + M.value, rescue: '🧍', horde: '🏚️', revive: '🤝' }[M.kind] || '⭐'}</div></div><div class="tz-rc-stats"><span>Wave <b>${st.wave || 0}</b></span><span>Kills <b>${st.kills || 0}</b></span><span>Level <b>${st.lvl || 0}</b></span>${st.score ? `<span>Score <b>${Number(st.score).toLocaleString('en-US')}</b></span>` : ''}${Rc.lead ? `<span>👑 ${nm(Rc.lead.name)}</span>` : ''}</div></div>`; }
    return html;
  }
  // ---------- the spotlight: a live picture from the phone of whoever is in trouble ----------
  function tvLive(m) { if (m && m.t === 'tv') { TV.snap = m; TV.snapAt = performance.now(); TV.snapPrev = TV.snapPrev && TV.snapPrev.from === m.from ? TV.snapCur : null; TV.snapCur = m; } }
  function spotDraw(c, t) {
    const s = TV.s, sp = s && s.spot, m = TV.snap, fresh = m && sp && m.from === sp.id && performance.now() - TV.snapAt < 2500;
    const box = c.parentElement; if (box) box.classList.toggle('on', !!fresh);
    if (!fresh) return;
    const wv = c.clientWidth, hv = c.clientHeight, d = Math.min(2, window.devicePixelRatio || 1); if (!wv || !hv) return;
    if (c.width !== Math.round(wv * d) || c.height !== Math.round(hv * d)) { c.width = Math.round(wv * d); c.height = Math.round(hv * d); }
    const g = c.getContext('2d'), Z = W(), TA = window.TZA; g.setTransform(d, 0, 0, d, 0, 0); g.fillStyle = '#0c0a08'; g.fillRect(0, 0, wv, hv);
    const you = m.you || [], hx = you[0] || Z.AW / 2, hy = you[1] || Z.AH / 2, k = Math.min(wv / 620, hv / 390), ox = wv / 2 / k - hx, oy = hv / 2 / k - (hy - 30);
    const key = m.c.join(',') + ':' + m.h; if (!TV.spotBg || TV.spotBg.key !== key) { const area = Z.genArea(s.seed, m.c[0], m.c[1], !!m.h); TV.spotBg = { key, area, cv: TA.areaCanvas(area, 0.45) }; }
    const B = TV.spotBg.cv; g.setTransform(d * k, 0, 0, d * k, ox * k * d, oy * k * d); g.drawImage(B.canvas, -TA.M, -TA.M, B.canvas.width / B.scale, B.canvas.height / B.scale);
    const kp = Math.max(0.2, Math.round(k * d * 10) / 10), list = [], ZT = Object.keys(Z.ZOMBIES), bk = new Map((m.bk || []).map(([i, key2]) => [i, key2]));
    for (let i = 0, j = 0; i < (m.z || []).length; i += 5, j++) list.push({ z: true, ti: m.z[i], x: m.z[i + 1], y: m.z[i + 2], hp: m.z[i + 3], face: m.z[i + 4], j, bk: bk.get(j) });
    list.push({ you: true, x: hx, y: hy }); for (const o of m.o || []) list.push({ other: true, id: o[0], x: o[1], y: o[2], down: o[5] }); if (m.n) list.push({ npc: true, x: m.n[0], y: m.n[1], name: m.n[2] });
    list.sort((a, b) => a.y - b.y);
    const who = (s.players || []).find((p) => p.id === m.from) || { id: m.from, name: '', color: '#fff' };
    for (const q of list) {
      if (q.z) { const type = ZT[q.ti] || 'walker'; if (q.bk && window.TZB) { window.TZB.drawBoss(g, { x: q.x, y: q.y, r: (Z.ZOMBIES[type] || {}).r || 60, hp: q.hp, mhp: 100, face: q.face, fb: q.bk, mb: q.bk }, t); continue; } const spr = TA.zombie(type, Math.floor(t * 6 + q.j) % 4, kp, false, q.j % 5); g.save(); g.translate(q.x, q.y); if (q.face < 0) g.scale(-1, 1); g.drawImage(spr, -spr.ox, -spr.oy, spr.width / kp, spr.height / kp); g.restore(); continue; }
      if (q.you) { if (window.TZMore && m.veh) window.TZMore.drawVehicle(g, m.veh, q.x, q.y, you[9] || 1, t, true, null); if (window.TZSim) window.TZSim.heroDraw(g, who, q.x, q.y, { k: kp, dead: !!m.dn, face: you[9] || 1, moving: true, walkT: t }); if (window.TZMore && m.fit && m.fit !== 'cape') window.TZMore.drawFit(g, m.fit, q.x, q.y, you[9] || 1, t, false); g.strokeStyle = who.color || '#fff'; g.lineWidth = 3; g.beginPath(); g.ellipse(q.x, q.y, 26, 10, 0, 0, TAU); g.stroke(); continue; }
      if (q.other) { const pw = (s.players || []).find((p) => p.id === q.id) || { id: q.id }; if (window.TZSim) window.TZSim.heroDraw(g, pw, q.x, q.y, { k: kp, dead: !!q.down, face: 1 }); continue; }
      if (q.npc && window.TZSim) window.TZSim.heroDraw(g, { id: 'npc:' + q.name, name: q.name, color: '#e8b830' }, q.x, q.y, { k: kp, face: 1, moving: true, walkT: t });
    }
    g.setTransform(d, 0, 0, d, 0, 0);
    if (m.wx === 'rain') { g.strokeStyle = 'rgba(190,210,230,0.35)'; g.lineWidth = 1; g.beginPath(); for (let i = 0; i < 50; i++) { const x = ((i * 97 + t * 400) % wv), y = ((i * 53 + t * 700) % hv); g.moveTo(x, y); g.lineTo(x - 3, y + 12); } g.stroke(); }
    else if (m.wx === 'fog') { g.fillStyle = 'rgba(170,175,185,0.28)'; g.fillRect(0, 0, wv, hv); } else if (m.wx === 'heat') { g.fillStyle = 'rgba(255,120,40,0.1)'; g.fillRect(0, 0, wv, hv); }
    if (m.dn) { g.fillStyle = `rgba(120,0,0,${0.25 + 0.1 * Math.sin(t * 6)})`; g.fillRect(0, 0, wv, hv); }
    const hpw = wv - 24, fr = m.mhp ? Math.max(0, m.hp / m.mhp) : 0; g.fillStyle = 'rgba(15,10,6,0.8)'; g.fillRect(10, hv - 26, hpw + 4, 16); g.fillStyle = fr < 0.3 ? '#ff4a3a' : '#5ad65a'; g.fillRect(12, hv - 24, hpw * fr, 12);
  }
  const spotTag = (sp) => `📺 SPOTLIGHT · <b style="color:${esc(sp.color || '#fff')}">${nm(sp.name)}</b> ${sp.why === 'down' ? '🆘 is DOWN: go help!' : `❤️ ${Math.max(0, Math.round(sp.hp))}/${sp.mhp} · in trouble!`}`;
  function spotHtml(s) { const sp = s.spot; if (!sp) return ''; return `<div class="tz-spotw ${sp.why === 'down' ? 'down' : ''}"><canvas id="tz-spotc"></canvas><div class="tz-spot-tag">${spotTag(sp)}</div></div>`; }
  function tvOver(el, s) {
    const st = s.standings || [], top = st.slice(0, 3);
    const scoreTxt = (r) => (r.score ? `<b class="tz-sc">${r.score.toLocaleString('en-US')} pts</b> · ` : '') + (r.scrap != null ? `<b class="tz-scrap">🔩 +${r.scrap}</b> · ` : '');
    const pod = top.map((r, i) => `<div class="tz-pod p${i + 1}"><div class="tz-pbody">${BOX.body ? BOX.body({ ...r, bot: true }, i === 0 ? 210 : 170, { mood: 'grin' }) : esc(r.avatar)}</div><div class="tz-pbase"><b>${['🥇', '🥈', '🥉'][i]} ${nm(r.name)}</b><small>${scoreTxt(r)}Wave ${r.wave} · ${r.kills} kills · Lv ${r.lvl}</small><div class="tz-ab">${abIcons(r.build)}</div></div></div>`).join('');
    const rest = st.slice(3).map((r, i) => `<li><span>#${i + 4}</span>${face(r, 34)}<b>${nm(r.name)}</b><small>Wave ${r.wave} · ${r.kills} kills · Lv ${r.lvl}</small><div class="tz-ab">${abIcons(r.build)}</div></li>`).join('');
    const S0 = s.story;
    if (S0 && (s.why === 'win' || s.why === 'lost')) {
      const won = s.why === 'win', finds = (S0.finds || []).map((f) => { const F = window.TZS.FINDS[f.id]; const who = (s.standings || []).find((r) => r.id === f.by); return F ? `<span class="tz-vf">${F.icon} ${esc(F.name)}<small>${who ? nm(who.name) : ''}</small></span>` : ''; }).join('');
      return BOX.morph(el, `<div class="tz-over ${won ? 'tz-victory' : 'tz-defeat'}">${won ? '<div class="tz-rays"></div><div class="tz-confetti"></div>' : ''}<h1 class="tz-logo">${won ? 'THE TOWN IS <b>SAVED!</b>' : 'THE TRASH <b>WON…</b>'}</h1><p class="tz-why">${won ? `${S0.boss ? S0.boss.icon + ' ' + esc(S0.boss.name) : 'The boss'} is down! ` : 'Everyone fell before the boss went down. '}⏱ ${timer(S0.time || 0)} · ${S0.kills} team kills · 🗝️ ${S0.keys}/3 · ${(S0.finds || []).length} finds</p><div class="tz-podium">${pod}</div>${finds ? `<div class="tz-vfinds">${finds}</div>` : ''}${rest ? `<ol class="tz-rest">${rest}</ol>` : ''}</div>`);
    }
    const why = { overrun: `The horde broke through: the town ran out of hope after ${s.garage ? s.garage.night : 0} horde night${s.garage && s.garage.night === 1 ? '' : 's'}.`, time: s.mode === 'score' || s.mode === 'garage' ? 'Time’s up! Highest score takes it.' : 'Time’s up! The garbage trucks roll in at dawn.', down: 'Everyone’s down. The zombies take the street…', w20: 'Wave 20 survived! The street is safe (for now).', host: 'The host called it a night.', empty: 'Everyone went home. The zombies have the town.' }[s.why] || 'The night is over.';
    BOX.morph(el, `<div class="tz-over"><h1 class="tz-logo">Just<b>Zombies</b></h1><p class="tz-why">${esc(why)}</p><div class="tz-podium">${pod}</div>${rest ? `<ol class="tz-rest">${rest}</ol>` : ''}</div>`);
  }

  // ======================================================================= PHONE
  const PH = { fpHeld: {}, fp: false, gl: null, root: null, cv: null, sim: null, run: null, v: null, ctx: null, raf: 0, last: 0, input: null, keys: new Set(), mouse: { x: 0, y: 0, down: false, on: false }, touch: { move: null, aim: null }, device: null, menu: false, frames: [], work: [], quality: 1, hint: 0, people: new Map(), overlay: '', vib: true };
  try { PH.vib = localStorage.getItem('tz.vib') !== '0'; PH.gfxPref = localStorage.getItem('tz.gfx') || 'auto'; } catch { PH.gfxPref = 'auto'; }
  // Graphics High / Low: picked per device (weak phones start on Low), and dropped to Low if frames get slow.
  PH.gfxAuto = ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 3) ? 'low' : 'high';
  const gfxHi = () => (PH.gfxPref === 'auto' ? PH.gfxAuto : PH.gfxPref) !== 'low';
  const isTouch = () => (PH.device ? PH.device === 'touch' : ('ontouchstart' in window || navigator.maxTouchPoints > 0));
  function report(msg, quiet) {
    if (!PH.ctx) return Promise.resolve({ ok: false });
    // status pings are quiet: no toasts for them
    return quiet ? new Promise((res) => { try { PH.ctx.act(msg).then(res); } catch { res({ ok: false }); } }) : PH.ctx.act(msg);
  }
  function buzz(ms) { if (!PH.vib) return; try { if (PH.ctx && PH.ctx.vibrate) PH.ctx.vibrate(ms); else if (navigator.vibrate) navigator.vibrate(ms); } catch { /* no */ } }
  const runKey = (me) => me.run + ':' + (me.comeback || 0);
  function newSim(v) {
    const me = { id: v.me.id, name: (PH.view && PH.view.me && PH.view.me.name) || 'You', color: (PH.view && PH.view.me && PH.view.me.color) || '#ffd23f', avatar: (PH.view && PH.view.me && PH.view.me.avatar) || '🙂' };
    PH.sim = new window.TZSim.Sim({
      seed: v.seed, homes: v.homes, me, settings: { diff: v.settings.diff, aim: PH.aimPref || v.settings.aim, xp: v.settings.xp }, restore: v.me, story: v.story, locks: v.locks || null,
      report, live: (m) => PH.ctx && PH.ctx.live && PH.ctx.live(m), people: (id) => PH.people.get(id), on: simEvent,
      mates: () => ((PH.v && PH.v.players) || []).filter((p) => !p.bot && p.state === 'play').length, stashes: () => (PH.v && PH.v.stashes) || [],
    });
    PH.run = runKey(v.me); PH.dead = null;
    const sv = loadRun(v); if (sv && PH.sim.loadSave && PH.sim.loadSave(sv)) setTimeout(() => { if (PH.ctx) PH.ctx.toast('💾 Run restored: your cash, weapons and items are back.'); }, 500);
    PH.sim.boardAnim = true; PH.sim.fpRide = !!(window.TZFP && TZFP.supported());
    if (PH.sim.setWorld) PH.sim.setWorld(v);
    if (v.area) PH.sim.setArea(v.area);
    if (v.me.cls && PH.sim.setClass) PH.sim.cls = v.me.cls; // back in with your class (Regular / Score attack)
    else if (PH.sim.setClass && !PH.sim.cls) setTimeout(classUi, 300);
    window.TZ_DEBUG = debugApi();
  }
  function simEvent(kind, d) {
    const ctx = PH.ctx;
    if (window.TZSnd) TZSnd.event(kind, d);
    if (kind === 'hurt') buzz(35);
    else if (kind === 'level') { if (ctx) ctx.haptic('win'); cardsUi(); }
    else if (kind === 'pickup') { if (ctx) ctx.haptic('success'); }
    else if (kind === 'boss') { buzz([80, 60, 120]); }
    else if (kind === 'down') { buzz(200); }
    else if (kind === 'dead') { buzz([120, 80, 300]); PH.dead = d; setTimeout(overlay, 1400); }
    else if (kind === 'clear') { if (ctx) ctx.haptic('success'); }
    else if (kind === 'enter') { if (ctx) ctx.haptic('turn'); }
    else if (kind === 'coop') { if (ctx) { ctx.haptic('big'); ctx.toast(d.mode === 'solo' ? 'You’re on your own again.' : `🤝 Co-op! ${d.members.length} of you in this area${d.mode === 'host' ? ' (your phone runs the zombies)' : ''}.`); } }
    else if (kind === 'start') { PH.hint = 7; }
    else if (kind === 'wave') { buzz([60, 40, 60]); if (PH.overlay === 'shop' || PH.overlay === 'call' || PH.overlay === 'map') setOverlay(''); }
    else if (kind === 'tick') { buzz(15); }
    else if (kind === 'rideend') { buzz([80, 40, 80]); }
    else if (kind === 'find') { const F = window.TZS.FINDS[d.id]; if (ctx) ctx.haptic('win'); showCard(`<span class="tz-rc-i">${F.icon}</span><div><small>${F.kind === 'key' ? 'IN THE CHEST: A KEY PIECE' : 'IN THE CHEST'}</small><b>${esc(F.name)}</b><p>${esc(F.desc)}</p></div>`, 'find'); }
    else if (kind === 'final') { buzz([200, 80, 200, 80, 400]); }
    else if (kind === 'combo') { if (ctx) { ctx.haptic('win'); ctx.toast(d.timed ? `💥 ${d.name}!` : '🧪 New combo! It’s in your combo book (pause menu).'); } }
    else if (kind === 'weapon' || kind === 'upgrade' || kind === 'item' || kind === 'core') { if (ctx) ctx.haptic('success'); }
    else if (kind === 'evolve') { setOverlay(''); buzz([60, 60, 60, 60, 300]); }
    else if (kind === 'debuff') { buzz(90); }
    else if (kind === 'truck' || kind === 'event') { if (ctx) ctx.haptic('turn'); }
    else if (kind === 'maps') { if (ctx) ctx.haptic('win'); mapUi(d.options); }
    else if (kind === 'downed') { buzz([200, 100, 200]); }
    else if (kind === 'revived') { if (ctx) ctx.haptic('success'); }
    else if (kind === 'unlock') { buzz([60, 40, 160]); }
    else if (kind === 'camper') { if (ctx) ctx.toast('🚐 A Survivor Camper pulled up: shop before you go!'); }
    else if (kind === 'buy') { if (ctx) ctx.haptic('select'); }
    else if (kind === 'victory') { if (ctx) ctx.haptic('win'); showCard('<span class="tz-rc-i">🏆</span><div><small>VICTORY</small><b>The boss is down!</b><p>The stink is lifting over the town…</p></div>', 'find'); }
    else if (kind === 'jingle') jingle();
    else if (kind === 'build') { buzz([60, 40, 60]); setTimeout(() => { if (PH.sim && PH.sim.build && !PH.menu) buildUi(); }, 700); }
    else if (kind === 'hordestart' || kind === 'sent') { buzz([120, 60, 120]); if (PH.overlay === 'build') setOverlay(''); }
    else if (kind === 'horde' || kind === 'rescue' || kind === 'crategot') { if (ctx) ctx.haptic(d && d.ok === false ? 'error' : 'win'); }
    else if (kind === 'crate' || kind === 'escort' || kind === 'ride' || kind === 'weather') { if (ctx) ctx.haptic('select'); }
    else if (kind === 'survlost' || kind === 'wreck') { buzz(160); }
    else if (kind === 'chestopen') { buzz([30, 40, 30, 40, 60]); }
    else if (kind === 'chestgot') { if (ctx) ctx.haptic('win'); if (d.kind === 'loot') showCard(`<span class="tz-rc-i">${d.id === 'vault' ? '💎' : '🧰'}</span><div><small>CHEST OPENED</small><b>${d.id === 'vault' ? 'A loot stash!' : 'The den’s hoard!'}</b><p>+$${d.cash} and goodies spilled out around the chest: grab them.</p></div>`, 'find'); }
  }
  function showCard(html, cls) {
    if (!PH.root) return;
    let c = PH.root.querySelector('.tz-rcard'); if (!c) { c = document.createElement('div'); c.className = 'tz-rcard'; PH.root.appendChild(c); }
    c.className = 'tz-rcard show ' + (cls || ''); c.innerHTML = html; clearTimeout(PH.cardT); PH.cardT = setTimeout(() => c.classList.remove('show'), cls === 'radio' ? 7000 : 4500);
  }
  function radio(v) {
    const B = (v.story && v.story.beats) || []; const last = B.length ? B[B.length - 1] : null;
    if (!last) return; if (PH.beatN == null) { PH.beatN = last.n - 1; }
    if (last.n > PH.beatN) { PH.beatN = last.n; setTimeout(() => showCard(`<span class="tz-rc-i">📻</span><div><small>${esc(window.TZS.RADIO)}</small><p>${esc(last.text)}</p></div>`, 'radio'), 300); }
  }
  // ---------- full screen (Android: the Fullscreen API + landscape lock; iPhone: Add to Home Screen) ----------
  const isIOS = () => /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => !!((window.matchMedia && matchMedia('(display-mode: standalone)').matches) || (window.matchMedia && matchMedia('(display-mode: fullscreen)').matches) || navigator.standalone);
  const isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  const canFull = () => !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
  async function goFull() {
    PH.fsAsked = true;
    const el = document.documentElement;
    try { if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' }); else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen(); } catch (e) { /* refused */ }
    try { if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape'); } catch (e) { /* not allowed here */ }
    fsButton();
  }
  function fsButton() {
    if (!PH.root) return;
    let b = PH.root.querySelector('.tz-fs');
    const show = !isFull() && !standalone() && (canFull() || isIOS()) && isTouch();
    if (!b) { b = document.createElement('button'); b.className = 'tz-fs'; b.innerHTML = '⛶ Full screen'; b.onclick = (e) => { e.stopPropagation(); if (canFull() && !isIOS()) goFull(); else iosHint(true); }; PH.root.appendChild(b); }
    b.hidden = !show;
  }
  // iPhone Safari has no Fullscreen API: the web app manifest makes a Home Screen icon open without bars.
  function iosHint(force) {
    if (!isIOS() || standalone() || (!force && PH.iosHinted)) return; PH.iosHinted = true;
    showCard('<span class="tz-rc-i">📲</span><div><small>FULL SCREEN ON IPHONE</small><b>Tap Share → Add to Home Screen for full screen</b><p>Then open JustGameBox from your home screen: no browser bars.</p></div>', 'find');
  }
  document.addEventListener('fullscreenchange', () => fsButton()); document.addEventListener('webkitfullscreenchange', () => fsButton());
  // ---------- the game root (full screen, kept between updates) ----------
  function ensureRoot(el) {
    if (PH.root && el.contains(PH.root)) return PH.root;
    el.innerHTML = '';
    const r = document.createElement('div'); r.className = 'tz-root';
    r.innerHTML = `<canvas class="tz-gl" hidden></canvas><canvas class="tz-cv"></canvas><button class="tz-pause" aria-label="Pause">⏸</button><div class="tz-ov" hidden></div><div class="tz-rot"><div>📱↻</div><b>Turn your phone sideways</b><small>JustZombies plays best in landscape. (You can still play like this.)</small><button class="btn small" data-rot>Play anyway</button></div>`;
    el.appendChild(r); PH.root = r; PH.cv = r.querySelector('.tz-cv'); PH.gl = r.querySelector('.tz-gl');
    r.querySelector('.tz-pause').onclick = (e) => { e.stopPropagation(); toggleMenu(); };
    r.querySelector('[data-rot]').onclick = () => { PH.rotOk = true; r.classList.remove('portrait'); };
    bindInput(r);
    if (window.TZI) TZI.boot(null, { low: !gfxHi() });
    if (window.TZFP) TZFP.prepare(); // three.js for the first-person rides
    document.body.classList.add('tz-playing');
    loop();
    return r;
  }
  function loop() {
    cancelAnimationFrame(PH.raf); PH.last = performance.now();
    const step = (now) => {
      if (!PH.root || !document.body.contains(PH.root)) { PH.raf = 0; document.body.classList.remove('tz-playing'); return; }
      const dt = Math.min(0.1, (now - PH.last) / 1000); PH.last = now;
      const t0 = performance.now();
      frame(dt);
      const work = performance.now() - t0;
      PH.frames.push(dt * 1000); PH.work.push(work); if (PH.frames.length > 240) { PH.frames.shift(); PH.work.shift(); }
      // keep it smooth: drop the resolution if frames get slow
      if (PH.frames.length >= 120) { const avg = PH.work.slice(-120).reduce((a, b) => a + b, 0) / 120; if (avg > 11 && PH.gfxPref === 'auto' && PH.gfxAuto === 'high') { PH.gfxAuto = 'low'; PH.frames.length = 0; PH.work.length = 0; } else if (avg > 14 && PH.quality > 0.7) { PH.quality = 0.7; PH.frames.length = 0; PH.work.length = 0; } }
      PH.raf = requestAnimationFrame(step);
    };
    PH.raf = requestAnimationFrame(step);
  }
  function view() {
    const c = PH.cv, w = c.clientWidth || innerWidth, h = c.clientHeight || innerHeight, dpr = Math.min(1.75, window.devicePixelRatio || 1) * PH.quality;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    return { w, h, dpr, k: Math.min(w, h) / 500, hi: gfxHi() }; // the original wide view the owner prefers, centred on the hero
  }
  function frame(dt) {
    const sim = PH.sim, V = view(), g = PH.cv.getContext('2d');
    PH.root.classList.toggle('portrait', V.h > V.w * 1.1 && !PH.rotOk);
    if (!sim) { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#0c0a08'; g.fillRect(0, 0, PH.cv.width, PH.cv.height); return; }
    if (window.TZI && !TZI.ready && !TZI.broken && (PH.loadT = (PH.loadT || 0) + dt) < 25) { loadingScreen(g, V); return; }
    if (window.TZI && TZI.ready && PH.artArea !== sim.area) { PH.artArea = sim.area; TZI.prefetchArea(sim); }
    if (window.TZSnd) TZSnd.frame(sim, dt);
    const I = readInput(V, sim);
    const busy = PH.menu || PH.overlay === 'shop' || PH.overlay === 'call' || PH.overlay === 'map' || PH.overlay === 'class' || PH.overlay === 'build' || PH.overlay === 'unlocks';
    sim.menuPause = !!PH.menu;
    sim.shopping = PH.overlay === 'shop' || PH.overlay === 'class' || PH.overlay === 'build' || PH.overlay === 'unlocks'; sim._dpr = V.dpr;
    if (performance.now() - (PH.saveAt || 0) > 2000) saveRun();
    if (busy && sim.mode === 'solo') sim.paused = true; else if (!sim.cards) sim.paused = false;
    sim._lastInput = I;
    sim.update(dt, I);
    V.k = V.k / sim.zoomStep(dt);
    if (sim.fpOut) { sim.fpOut.t += dt; if (sim.fpOut.t >= 0.6) sim.fpOut = null; }
    const fp = !!(window.TZFP && TZFP.ready && ((sim.ride && sim.ride.fp) || sim.fpOut)); PH.fp = fp;
    if (PH.gl && PH.gl.hidden === fp) PH.gl.hidden = !fp;
    if (fp && TZFP.render(sim, V, PH.gl)) TZFP.overlay(g, sim, V, dt, isTouch() ? PH.fpHeld : null);
    else { PH.fp = false; window.TZSim.render(g, sim, V); }
    hud(g, sim, V, dt);
  }
  // the loading screen while the art set decodes (TZI.boot)
  function loadingScreen(g, V) {
    const d = V.dpr, w = V.w, h = V.h, u = TZI.st.loaded / Math.max(1, TZI.st.total);
    g.setTransform(d, 0, 0, d, 0, 0); g.fillStyle = '#0c0a08'; g.fillRect(0, 0, w, h);
    const gr = g.createRadialGradient(w / 2, h * 0.45, 10, w / 2, h * 0.45, Math.max(w, h) * 0.6); gr.addColorStop(0, 'rgba(120,180,60,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `bold ${Math.round(Math.min(w, h) * 0.12)}px "Lilita One", sans-serif`; g.lineWidth = 6; g.strokeStyle = '#1b1410'; g.strokeText('JustZombies', w / 2, h * 0.38); g.fillStyle = '#9cff5a'; g.fillText('JustZombies', w / 2, h * 0.38);
    const bw = Math.min(360, w * 0.6), bx = w / 2 - bw / 2, by = h * 0.58; g.fillStyle = 'rgba(255,255,255,0.12)'; roundRect(g, bx, by, bw, 14, 7); g.fill(); g.fillStyle = '#9cff5a'; roundRect(g, bx, by, Math.max(14, bw * u), 14, 7); g.fill();
    g.font = 'bold 15px "Lilita One", sans-serif'; g.fillStyle = '#ffe9a8'; g.fillText(`Loading the town… ${Math.round(u * 100)}%`, w / 2, by + 34);
  }
  // ---------- input ----------
  function stickZone(V) { const r = Math.max(46, Math.min(70, Math.min(V.w, V.h) * 0.13)); return { x: V.w - r - 28, y: V.h - r - 28, r }; }
  function bindInput(r) {
    const cv = PH.cv;
    const pos = (e) => { const b = cv.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
    cv.addEventListener('pointerdown', (e) => {
      const p = pos(e);
      if (e.pointerType === 'mouse') { if (PH.sim && PH.sim.boarding) PH.sim.skipBoard = true; if (e.button === 0 && (hitButton(p.x, p.y) || clickChest(p.x, p.y))) return; PH.device = 'mouse'; PH.mouse.on = true; PH.mouse.x = p.x; PH.mouse.y = p.y; if (e.button === 0) PH.mouse.down = true; return; }
      PH.device = 'touch'; e.preventDefault();
      if (PH.sim && PH.sim.boarding) { PH.sim.skipBoard = true; return; }
      if (PH.fp && PH.sim && PH.sim.ride) { const Vv = { w: cv.clientWidth, h: cv.clientHeight }; const b = TZFP.controls(Vv, PH.sim).find((c) => Math.hypot(p.x - c.x, p.y - c.y) < c.r * 1.25); if (b) { PH.fpHeld[b.id] = e.pointerId; try { cv.setPointerCapture(e.pointerId); } catch { /* fine */ } return; } if (hitButton(p.x, p.y)) return; if (p.x > Vv.w / 2) { if (!PH.touch.aim) PH.touch.aim = { id: e.pointerId, x: p.x, y: p.y, ox: p.x }; } else if (!PH.touch.move) PH.touch.move = { id: e.pointerId, ox: p.x, oy: p.y, x: p.x, y: p.y }; try { cv.setPointerCapture(e.pointerId); } catch { /* fine */ } return; }
      if (hitButton(p.x, p.y) || clickChest(p.x, p.y) || hitMinimap(p.x, p.y)) return;
      if (!PH.fsAsked && canFull() && !isIOS() && !isFull() && !standalone()) goFull(); else if (!PH.iosHinted) iosHint(false);
      if (PH.sim && PH.sim.phase === 'intro') PH.skip = true;
      const V = { w: cv.clientWidth, h: cv.clientHeight }, Z = stickZone(V);
      if (!PH.touch.aim && Math.hypot(p.x - Z.x, p.y - Z.y) < Z.r * 1.45) { PH.touch.aim = { id: e.pointerId, x: p.x, y: p.y }; }
      else if (!PH.touch.move) PH.touch.move = { id: e.pointerId, ox: p.x, oy: p.y, x: p.x, y: p.y };
      try { cv.setPointerCapture(e.pointerId); } catch { /* fine */ }
    }, { passive: false });
    cv.addEventListener('pointermove', (e) => {
      const p = pos(e);
      if (e.pointerType === 'mouse') { if (PH.device !== 'mouse' && Math.abs(e.movementX) + Math.abs(e.movementY) < 2) return; PH.device = 'mouse'; PH.mouse.on = true; PH.mouse.x = p.x; PH.mouse.y = p.y; return; }
      const T = PH.touch;
      if (T.aim && T.aim.id === e.pointerId) { T.aim.x = p.x; T.aim.y = p.y; }
      else if (T.move && T.move.id === e.pointerId) { T.move.x = p.x; T.move.y = p.y; const R = 64, dx = p.x - T.move.ox, dy = p.y - T.move.oy, d = Math.hypot(dx, dy); if (d > R * 1.6) { T.move.ox = p.x - (dx / d) * R * 1.6; T.move.oy = p.y - (dy / d) * R * 1.6; } }
    }, { passive: false });
    const up = (e) => {
      if (e.pointerType === 'mouse') { if (e.button === 0) PH.mouse.down = false; return; }
      const T = PH.touch; if (T.aim && T.aim.id === e.pointerId) T.aim = null; if (T.move && T.move.id === e.pointerId) T.move = null;
      for (const k of Object.keys(PH.fpHeld)) if (PH.fpHeld[k] === e.pointerId) delete PH.fpHeld[k];
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    if (!PH.keysBound) {
      PH.keysBound = true;
      window.addEventListener('keydown', (e) => {
        if (!PH.root || !document.body.contains(PH.root)) return;
        if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
        const k = e.key.toLowerCase();
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'e', ' '].includes(k)) { e.preventDefault(); PH.keys.add(k); if (PH.device !== 'mouse') PH.device = 'mouse'; }
        if (k === 'escape' || k === 'p') { e.preventDefault(); toggleMenu(); }
        if (PH.sim && PH.sim.cards && ['1', '2', '3'].includes(k)) choose(Number(k) - 1);
        if (k === 'h' && PH.sim && PH.sim.down) { e.preventDefault(); helperUi(); }
        if (PH.sim && !PH.sim.cards && !PH.menu) { const act = { f: PH.sim.chestNear && PH.sim.chestNear() ? 'chest' : 'shop', b: 'bomb', t: 'turret', q: 'pocket', c: 'call', v: 'ride', g: 'build', m: 'map' }[k]; if (act) { e.preventDefault(); button(act); } }
        if (PH.sim && PH.sim.phase === 'intro' && (k === ' ' || k === 'enter')) PH.skip = true;
        if (k === 'enter' && PH.root.querySelector('[data-again]')) PH.root.querySelector('[data-again]').click();
      });
      window.addEventListener('keyup', (e) => PH.keys.delete(e.key.toLowerCase()));
      window.addEventListener('blur', () => { PH.keys.clear(); PH.mouse.down = false; });
    }
  }
  function readInput(V, sim) {
    const I = { mx: 0, my: 0, ax: 0, ay: 0, fire: false, mouse: false, grab: false, skip: !!PH.skip };
    const K = PH.keys;
    if (K.has('a') || K.has('arrowleft')) I.mx -= 1; if (K.has('d') || K.has('arrowright')) I.mx += 1;
    if (K.has('w') || K.has('arrowup')) I.my -= 1; if (K.has('s') || K.has('arrowdown')) I.my += 1;
    if (K.has('e')) I.grab = true;
    const T = PH.touch;
    if (T.move) { const dx = T.move.x - T.move.ox, dy = T.move.y - T.move.oy, d = Math.hypot(dx, dy), R = 64; if (d > 8) { I.mx = (dx / Math.max(d, R)) * Math.min(1, d / R); I.my = (dy / Math.max(d, R)) * Math.min(1, d / R); } }
    // up on the screen moves you up the screen: the iso camera turns screen directions into world ones
    const s2w = (sim.cam && sim.cam.dirToWorld) || ((x, y) => [x, y]);
    if (I.mx || I.my) [I.mx, I.my] = s2w(I.mx, I.my);
    if (T.aim) { const Z = stickZone(V), dx = T.aim.x - Z.x, dy = T.aim.y - Z.y; if (Math.hypot(dx, dy) > Z.r * 0.22) { [I.ax, I.ay] = s2w(dx, dy); I.fire = true; } }
    else if (PH.device === 'mouse' && PH.mouse.on && sim.cam) {
      // the point under the cursor at chest height (the iso camera), or on the flat map
      const C = sim.cam, [wx, wy] = C.toWorld(PH.mouse.x, PH.mouse.y, 30);
      I.mouse = true; I.ax = wx - sim.p.x; I.ay = wy - (C.s ? sim.p.y : sim.p.y - 26); I.fire = PH.mouse.down || K.has(' ');
      if (!I.ax && !I.ay) I.ax = 0.001;
    }
    if (sim.ride && sim.ride.fp) {
      const r = sim.ride, H = PH.fpHeld, D = { steer: 0, gas: 0, fire: false };
      if (K.has('a') || K.has('arrowleft')) D.steer -= 1; if (K.has('d') || K.has('arrowright')) D.steer += 1;
      if (K.has('w') || K.has('arrowup')) D.gas += 1; if (K.has('s') || K.has('arrowdown')) D.gas -= 1;
      if (H.gas != null) D.gas += 1; if (H.brake != null) D.gas -= 1;
      if (T.move) { const dx = T.move.x - T.move.ox, dy = T.move.y - T.move.oy; D.steer += Math.max(-1, Math.min(1, dx / 56)); if (H.gas == null && H.brake == null && Math.abs(dy) > 20) D.gas += Math.max(-1, Math.min(1, -dy / 56)); }
      D.fire = H.fire != null || K.has(' ') || (PH.device === 'mouse' && PH.mouse.down);
      if (r.kind === 'tank') { if (T.aim) { D.turn = Math.max(-1, Math.min(1, (T.aim.x - T.aim.ox) / 60)); } else if (PH.device === 'mouse' && PH.mouse.on) D.tur = (r.head || 0) + (PH.mouse.x / Math.max(1, V.w) - 0.5) * 1.6; }
      D.gas = Math.max(-1, Math.min(1, D.gas)); D.steer = Math.max(-1, Math.min(1, D.steer)); I.drive = D; I.fire = false; I.ax = 0; I.ay = 0;
    }
    if (PH.skip) PH.skip = false;
    return I;
  }
  // ---------- HUD (drawn on the canvas, screen space) ----------
  function hud(g, sim, V, dt) {
    const d = V.dpr, P = sim.p, S = sim.S, Z = W(), w = V.w, h = V.h, small = Math.min(w, h) < 420;
    g.setTransform(d, 0, 0, d, 0, 0);
    const font = (px) => `bold ${px}px "Lilita One", sans-serif`;
    const txt = (s, x, y, px, c = '#fff', al = 'left') => { g.font = font(px); g.textAlign = al; g.textBaseline = 'middle'; g.lineWidth = Math.max(3, px / 5); g.strokeStyle = 'rgba(15,10,6,0.9)'; g.strokeText(s, x, y); g.fillStyle = c; g.fillText(s, x, y); };
    if (sim.phase === 'intro') { txt(sim.introT < 1.3 ? '…' : 'Rise and shine.', w / 2, h * 0.82, small ? 20 : 26, '#ffe9a8', 'center'); txt('tap to skip', w / 2, h - 18, 12, 'rgba(255,255,255,0.6)', 'center'); return; }
    // top-left: health, armour, shield, level + XP
    const bw = Math.min(260, w * 0.32), bx = 14, by = 14, bh = small ? 16 : 20;
    g.fillStyle = 'rgba(15,10,6,0.75)'; roundRect(g, bx - 4, by - 4, bw + 8, bh + 8, 8); g.fill();
    const hp = Math.max(0, P.hp / S.mhp); g.fillStyle = hp < 0.3 ? '#ff4a3a' : '#5ad65a'; roundRect(g, bx, by, bw * hp, bh, 6); g.fill();
    txt(`❤ ${Math.ceil(Math.max(0, P.hp))}/${Math.round(S.mhp)}`, bx + 8, by + bh / 2 + 1, small ? 12 : 14);
    let ix = bx + bw + 14;
    if (P.armor > 0) { txt('🗑️', ix, by + bh / 2, 18); ix += 26; }
    if (P.lives > 0) { txt('🍱×' + P.lives, ix, by + bh / 2, 15); ix += 44; }
    // XP bar
    const xy = by + bh + 10, need = Z.xpNeed(sim.lvl);
    g.fillStyle = 'rgba(15,10,6,0.75)'; roundRect(g, bx - 4, xy - 3, bw + 8, 12, 6); g.fill();
    g.fillStyle = '#5affc8'; roundRect(g, bx, xy, bw * Math.min(1, sim.xp / need), 6, 3); g.fill();
    txt('LV ' + sim.lvl, bx, xy + 20, small ? 14 : 16, '#5affc8');
    // buffs
    let fy = xy + 40;
    for (const [k, v] of Object.entries(sim.buffs)) if (v > 0) { const Pk = Z.PK[k === 'kicks' ? 'kicks' : k]; if (!Pk) continue; txt(`${Pk.icon} ${Math.ceil(v)}s`, bx, fy, small ? 14 : 16, Pk.color); fy += small ? 20 : 24; }
    // score + streak multiplier (big), cash
    if (sim._pl) {
      const sc = Math.round(sim.score).toLocaleString('en-US'), mx = w * 0.5 + (small ? 150 : 190);
      txt(sc, mx, 22, small ? 20 : 26, '#fff6d8', 'left');
      if (sim.mult > 1) { const pulse = 1 + 0.08 * Math.sin(sim.t * 10); g.save(); g.translate(mx + 8, small ? 50 : 58); g.scale(pulse, pulse); txt('×' + sim.mult, 0, 0, (small ? 22 : 28) + sim.mult * 1.5, ['#ffe066', '#ffb02e', '#ff7a3c', '#ff4a6a', '#d06aff'][Math.min(4, sim.mult - 2)], 'left'); g.restore(); const bw2 = 60; g.fillStyle = 'rgba(15,10,6,0.7)'; g.fillRect(mx + 70, (small ? 46 : 54), bw2, 6); g.fillStyle = '#ffb02e'; g.fillRect(mx + 70, (small ? 46 : 54), bw2 * Math.max(0, sim.comboT / 3.2), 6); }
      txt('$' + sim.cash, bx, fy, small ? 15 : 17, '#ffd23f'); fy += small ? 22 : 26;
      if (sim.plates) { txt('🛡️×' + sim.plates, bx, fy, 14); fy += 22; }
    }
    if (sim._fi) {
      // your weapons (level, tier stars), crucible cores, debuffs with timers
      const ws = [sim.gun, ...sim.weapons], s0 = small ? 26 : 30; let wx = bx;
      for (const wpn of ws) { const Wd = window.TZR.WEAPONS[wpn.id]; g.fillStyle = 'rgba(15,10,6,0.72)'; roundRect(g, wx, fy - s0 / 2, s0, s0, 6); g.fill(); g.strokeStyle = wpn.tier >= 3 ? '#ffd23f' : wpn.tier === 2 ? '#8ab0d0' : 'rgba(255,255,255,0.3)'; g.lineWidth = 2; g.stroke(); g.font = `${Math.round(s0 * 0.6)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(Wd.icon, wx + s0 / 2, fy); txt(String(wpn.lv), wx + s0 - 3, fy + s0 / 2 - 4, 10, '#fff', 'right'); if (wpn.tier > 1) txt('★'.repeat(wpn.tier - 1), wx + 3, fy - s0 / 2 + 5, 9, '#ffd23f', 'left'); wx += s0 + 4; }
      if (sim.cores) { txt('🔥×' + sim.cores, wx + 4, fy, 13, '#ff8c42'); }
      fy += s0 / 2 + 16;
      for (const [k, v2] of Object.entries(sim.debuffs || {})) { if (!(v2 > 0)) continue; const D = window.TZR.DEBUFFS[k]; g.strokeStyle = '#ff6a5a'; g.lineWidth = 3; g.beginPath(); g.arc(bx + 12, fy, 12, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, v2 / D.dur)); g.stroke(); txt(D.icon, bx + 12, fy, 13, '#fff', 'center'); txt(D.name + (k === 'web' ? ': wiggle to break free!' : ''), bx + 30, fy, small ? 12 : 14, '#ff9a8a'); fy += 28; }
      if (sim.tcombo) { txt(sim.tcombo.icon + ' ' + sim.tcombo.name, bx, fy, small ? 13 : 15, '#ffb02e'); fy += 22; }
    }
    // top-centre: wave + zombies left
    const left = sim.spec ? Math.max(0, sim.spec.target - sim.waveKills) : 0;
    txt(`WAVE ${sim.wave}`, w / 2, 22, small ? 20 : 26, '#ffd23f', 'center');
    txt(sim.cleared ? '✅ Clear: shop or walk on' : `🧟 ${Math.max(left, sim.z.length)} left`, w / 2, small ? 44 : 50, small ? 13 : 16, sim.cleared ? '#7dff6a' : '#fff', 'center');
    // the break between waves: a big countdown; at zero the next wave starts here by itself
    const bT = sim.cleared && sim.breakT != null && !sim.build && !sim.dead ? sim.breakT : sim.build && sim.build.endsAt ? Math.max(0, (sim.build.endsAt - Date.now()) / 1000) : null;
    if (bT != null && sim.phase === 'play') {
      const R0 = small ? 26 : 32, cx = w / 2, cy = (small ? 112 : 132) + (st || gate ? 18 : 0), hot = bT <= 5, n = Math.ceil(bT), full = sim.build ? 45 : (window.TZSim.BREAK_S || 30);
      g.fillStyle = 'rgba(15,10,6,0.78)'; g.beginPath(); g.arc(cx, cy, R0 + 6, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, R0, 0, TAU); g.stroke();
      g.strokeStyle = hot ? (Math.sin(sim.t * 14) > 0 ? '#ff4a3a' : '#ffb02e') : sim.build ? '#ffb02e' : '#9cff5a'; g.beginPath(); g.arc(cx, cy, R0, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, bT / full)); g.stroke();
      const pulse = hot ? 1 + 0.12 * Math.max(0, Math.sin(sim.t * 12)) : 1; g.save(); g.translate(cx, cy + 1); g.scale(pulse, pulse); txt(String(n), 0, 0, small ? 26 : 32, hot ? '#ff6a5a' : '#fff6d8', 'center'); g.restore();
      txt(sim.build ? '🔨 HORDE IN' : 'NEXT WAVE IN', cx, cy - R0 - 14, small ? 11 : 13, hot ? '#ff8c6a' : '#ffe9a8', 'center');
    }
    const st = sim.story, ng = sim.nextGate ? sim.nextGate() : null, gate = ng ? `🔒 ${ng.have} / ${ng.need} kills${ng.here ? ' (gate here)' : ''}` : sim.locks ? '🔓 every gate open' : '';
    if (st || gate) txt(`${st ? `🗝️ ${st.keys}/3   🗺️ ${st.maps}/2   ` : ''}${gate}`, w / 2, small ? 80 : 94, small ? 12 : 14, '#ffe9a8', 'center');
    if (st) {
      const fb = sim.z.find((z) => z.fb);
      if (fb) { const bw2 = Math.min(520, w * 0.6), bx2 = (w - bw2) / 2, by3 = h - 30; g.fillStyle = 'rgba(15,10,6,0.8)'; roundRect(g, bx2 - 4, by3 - 4, bw2 + 8, 22, 8); g.fill(); g.fillStyle = '#ff4a3a'; roundRect(g, bx2, by3, bw2 * Math.max(0, fb.hp / fb.mhp), 14, 6); g.fill(); const B = window.TZS.BOSSES[fb.fb]; txt(B.icon + ' ' + B.name, w / 2, by3 - 14, small ? 14 : 18, '#ffd23f', 'center'); }
    }
    if (sim.mode !== 'solo') txt(sim.mode === 'host' ? '🤝 CO-OP (host)' : '🤝 CO-OP', w / 2, small ? 62 : 72, 12, '#ffd23f', 'center');
    // top-right: minimap (under the pause button)
    minimap(g, sim, V);
    hud3(g, sim, V, txt);
    buttons(g, sim, V, txt);
    if (sim.down) { const a = 0.5 + 0.5 * Math.sin(sim.t * 6); g.fillStyle = `rgba(120,0,0,${0.25 + 0.1 * a})`; g.fillRect(0, 0, w, h); txt('🆘 YOU’RE DOWN', w / 2, h * 0.4, small ? 30 : 40, '#ff8c6a', 'center'); txt(`A friend can pick you up: ${Math.ceil(sim.down.t)} s`, w / 2, h * 0.4 + 34, small ? 15 : 18, '#fff', 'center'); }
    route(g, sim, V, txt);
    // the banner
    if (sim.banner) { const a = Math.min(1, sim.banner.t * 2), by2 = h * 0.24; g.globalAlpha = a; txt(sim.banner.text, w / 2, by2, small ? 34 : 46, '#ffd23f', 'center'); txt(sim.banner.sub, w / 2, by2 + (small ? 30 : 40), small ? 14 : 18, '#fff', 'center'); g.globalAlpha = 1; }
    // control hints
    if (PH.hint > 0 && !PH.fp) { PH.hint -= dt; g.globalAlpha = Math.min(1, PH.hint); txt(isTouch() ? 'Drag anywhere to move · right stick to aim' + (sim.set.aim !== 'off' ? ' (or just move: it auto-aims)' : '') : 'WASD to move · mouse to aim · hold click to shoot · Esc to pause', w / 2, h - 22, small ? 12 : 15, '#ffe9a8', 'center'); g.globalAlpha = 1; }
    // sticks (touch)
    if (isTouch() && !sim.dead && !PH.fp) {
      const Zs = stickZone(V), T = PH.touch;
      g.globalAlpha = T.aim ? 0.9 : 0.55; g.fillStyle = 'rgba(15,10,6,0.45)'; g.beginPath(); g.arc(Zs.x, Zs.y, Zs.r, 0, TAU); g.fill(); g.strokeStyle = '#ff5a3c'; g.lineWidth = 3; g.stroke();
      let kx = Zs.x, ky = Zs.y; if (T.aim) { const dx = T.aim.x - Zs.x, dy = T.aim.y - Zs.y, dd = Math.hypot(dx, dy) || 1, m = Math.min(dd, Zs.r * 0.7); kx += (dx / dd) * m; ky += (dy / dd) * m; }
      g.fillStyle = '#ff5a3c'; g.beginPath(); g.arc(kx, ky, Zs.r * 0.42, 0, TAU); g.fill(); g.globalAlpha = 1;
      txt(T.aim ? '🔥' : sim.set.aim !== 'off' ? 'AUTO' : 'AIM', Zs.x, Zs.y - Zs.r - 12, 12, '#fff', 'center');
      if (T.move) { g.globalAlpha = 0.5; g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(T.move.ox, T.move.oy, 56, 0, TAU); g.stroke(); const dx = T.move.x - T.move.ox, dy = T.move.y - T.move.oy, dd = Math.hypot(dx, dy) || 1, m = Math.min(dd, 56); g.fillStyle = '#fff'; g.beginPath(); g.arc(T.move.ox + (dx / dd) * m, T.move.oy + (dy / dd) * m, 24, 0, TAU); g.fill(); g.globalAlpha = 1; }
    }
    // off-screen warnings: red arrows for zombies just outside the view, icons for pickups
    if (sim.cam && !sim.dead && sim.phase === 'play' && !PH.fp) {
      const C = sim.cam, edge = (wx, wy) => { const [sx, sy] = C.toScreen(wx, wy); if (sx > 0 && sx < w && sy > 0 && sy < h) return null; const cx = w / 2, cy = h / 2, a = Math.atan2(sy - cy, sx - cx); const m = 26, tx = Math.cos(a), ty = Math.sin(a), sc = Math.min((w / 2 - m) / Math.max(0.001, Math.abs(tx)), (h / 2 - m) / Math.max(0.001, Math.abs(ty))); return { x: cx + tx * sc, y: Math.max(small ? 70 : 84, cy + ty * sc), a }; };
      const near = []; for (const z of sim.z) { if (z.hp <= 0) continue; const d = Math.hypot(z.x - P.x, z.y - P.y); if (d < 760) near.push([d, z]); }
      near.sort((x, y) => x[0] - y[0]);
      let shown = 0;
      for (const [d, z] of near) { if (shown >= 10) break; const e = edge(z.x, z.y - z.r); if (!e) continue; shown++; g.save(); g.translate(e.x, e.y); g.rotate(e.a); g.globalAlpha = Math.max(0.35, 1 - d / 760); g.fillStyle = z.fb || z.boss ? '#ff2a1a' : '#ff5a3c'; g.beginPath(); g.moveTo(14, 0); g.lineTo(-8, -10); g.lineTo(-4, 0); g.lineTo(-8, 10); g.closePath(); g.fill(); g.strokeStyle = '#1b1410'; g.lineWidth = 2; g.stroke(); g.restore(); }
      g.globalAlpha = 1;
      for (const p of sim.pk) { const e = edge(p.x, p.y); if (!e) continue; const Pk = Z.PK[p.k]; g.font = '18px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(15,10,6,0.7)'; g.beginPath(); g.arc(e.x, e.y, 15, 0, TAU); g.fill(); g.fillText(Pk ? Pk.icon : '✨', e.x, e.y + 1); }
      const Ch = sim.chestHere && sim.chestHere(); if (Ch) { const e = edge(Ch.x, Ch.y - 30); if (e) { g.fillStyle = 'rgba(15,10,6,0.7)'; g.beginPath(); g.arc(e.x, e.y, 16, 0, TAU); g.fill(); g.font = '20px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(Ch.kind === 'find' && (window.TZS.FINDS[Ch.id] || {}).kind === 'key' ? '🗝️' : '🧰', e.x, e.y + 1); } }
    }
    // exit arrows at the screen edge pointing to exits when cleared
    if (sim.cleared && !sim.dead && !PH.fp) {
      const C = sim.cam; if (C) for (const [dd, ok] of Object.entries(sim.area.exits)) {
        if (!ok || sim.gateLeft(dd)) continue; const ex = dd === 'w' ? 0 : dd === 'e' ? Z.AW : ok.p, ey = dd === 'n' ? 0 : dd === 's' ? Z.AH : ok.p;
        const [sx, sy] = C.toScreen(ex, ey); if (sx > 30 && sx < w - 30 && sy > 30 && sy < h - 30) continue;
        const cx = Math.max(40, Math.min(w - 40, sx)), cy = Math.max(90, Math.min(h - 40, sy)), a = Math.atan2(sy - h / 2, sx - w / 2);
        g.save(); g.translate(cx, cy); g.rotate(a); g.globalAlpha = 0.6 + 0.4 * Math.sin(sim.t * 6); g.fillStyle = '#7dff6a'; g.beginPath(); g.moveTo(18, 0); g.lineTo(-10, -14); g.lineTo(-10, 14); g.closePath(); g.fill(); g.restore(); g.globalAlpha = 1;
      }
    }
  }
  // ---------- the buttons on the canvas (shop, pocket, bomb, turret, call-out) ----------
  function buttons(g, sim, V, txt) {
    PH.btns = []; if (!sim._pl || sim.dead || sim.phase !== 'play') return;
    const small = Math.min(V.w, V.h) < 420, r = small ? 22 : 26, y = V.h - r - 16, Zs = stickZone(V);
    const L = [];
    if (sim.down) { L.push({ id: 'help', icon: '🙌', label: 'HELP', big: true }); }
    else if (PH.fp) { if (sim.ride) L.push({ id: 'ride', icon: '🚪', label: 'GET OUT', big: true }); }
    else {
    const cn = sim.chestNear && sim.chestNear(); if (cn) L.push({ id: 'chest', icon: '🧰', label: 'OPEN', big: !sim.nearShop });
    if (sim.nearShop) L.push({ id: 'shop', icon: '🛒', label: 'SHOP', big: true });
    const nv = sim.nearVehicle && sim.nearVehicle(); if (sim.ride || nv) L.push({ id: 'ride', icon: sim.ride ? '🚪' : window.TZX.VEHICLES[nv.kind].icon, label: sim.ride ? 'GET OUT' : 'GET IN', big: !sim.nearShop });
    if (sim.build) L.push({ id: 'build', icon: '🔨', label: 'BUILD' });
    if (sim.pocket) L.push({ id: 'pocket', icon: (W().PK[sim.pocket] || {}).icon || '🎒' });
    if (sim.bombs) L.push({ id: 'bomb', icon: '💣', n: sim.bombs });
    if (sim.kits) L.push({ id: 'turret', icon: '🗼', n: sim.kits });
    L.push({ id: 'call', icon: '📣' });
    }
    let x = Zs.x - Zs.r - 20 - r;
    for (const b of L) {
      const R = b.big ? r * 1.35 : r, cy = b.big ? Zs.y - Zs.r - R - 30 : y, cx = b.big ? Zs.x : x; if (!b.big) x -= r * 2 + 10;
      PH.btns.push({ id: b.id, x: cx, y: cy, r: R + 6 });
      g.globalAlpha = b.big ? 0.85 + 0.15 * Math.sin(sim.t * 8) : 0.85; g.fillStyle = b.big ? '#9cff3c' : 'rgba(15,10,6,0.7)'; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill(); g.strokeStyle = b.big ? '#1b1410' : 'rgba(255,255,255,0.5)'; g.lineWidth = 2.5; g.stroke(); g.globalAlpha = 1;
      g.font = `${Math.round(R * 0.95)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(b.icon, cx, cy + 1);
      if (b.n > 1) txt('×' + b.n, cx + R * 0.7, cy - R * 0.7, 12, '#fff', 'center');
      if (b.label) txt(b.label, cx, cy - R - 10, 13, '#9cff3c', 'center');
    }
  }
  function hitButton(x, y) { for (const b of PH.btns || []) if (Math.hypot(x - b.x, y - b.y) < b.r) { button(b.id); return true; } return false; }
  // tap / click the chest itself (when you're next to it)
  function clickChest(x, y) {
    const sim = PH.sim; if (!sim || !sim.chestNear || !sim.cam) return false; const C = sim.chestNear(); if (!C) return false;
    const [wx, wy] = sim.cam.toWorld(x, y, 30); if (Math.hypot(wx - C.x, wy - C.y) > 120) return false;
    return button('chest');
  }
  function hitMinimap(x, y) { const M = PH.mm; if (!M || !PH.sim || PH.sim.phase !== 'play' || x < M.x || x > M.x + M.w || y < M.y || y > M.y + M.h) return false; townMapUi(); return true; }
  // ---------- the town map (tap the minimap, or M): every block, what's locked and how many kills it needs ----------
  function townMapUi() {
    const v = PH.v, sim = PH.sim; if (!v || !sim) return;
    const ov = setOverlay(`<div class="tz-tmap"><div class="tz-tmh"><h2>🗺️ The town</h2><span>${v.locks ? `🧟 ${v.locks.kills} team kills` : ''}</span><button class="btn small ghost" data-close>Close ✕</button></div><canvas class="tz-tmc"></canvas><p class="tz-mut">🔒 Locked blocks open as the team’s kills rise: ⭐ special ones (the best shops, dens, loot stashes, key vaults, the lair) need lots more and are tougher. Locked gates are detours: there’s always another road.</p></div>`, 'map');
    if (!ov) return;
    ov.querySelector('[data-close]').onclick = (e) => { e.stopPropagation(); setOverlay(''); };
    const c = ov.querySelector('.tz-tmc'), paint = () => {
      if (!c.isConnected || PH.overlay !== 'map') return; const wv = c.clientWidth, hv = c.clientHeight, d = Math.min(2, window.devicePixelRatio || 1);
      if (c.width !== Math.round(wv * d) || c.height !== Math.round(hv * d)) { c.width = Math.round(wv * d); c.height = Math.round(hv * d); }
      const g = c.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0);
      const me = { id: sim.me.id, name: 'You', color: sim.me.color, avatar: sim.me.avatar, x: sim.cell[0], y: sim.cell[1], state: sim.dead ? 'dead' : 'play', wave: sim.wave, hp: sim.p.hp, mhp: sim.S.mhp };
      drawMap(g, wv, hv, performance.now() / 1000, { ...v, players: [me, ...(v.players || [])], explored: (v.explored || []).map((e) => [e[0], e[1]]) });
      requestAnimationFrame(paint);
    };
    requestAnimationFrame(paint);
  }
  function button(id) {
    const sim = PH.sim; if (!sim || sim.dead || !sim._pl) return false;
    if (id === 'help') { helperUi(); return true; }
    if (sim.down) return false;
    if (id === 'chest') return !!(sim.openChest && sim.openChest());
    if (id === 'map') { townMapUi(); return true; }
    if (id === 'ride') { const r = sim.toggleRide && sim.toggleRide(); if (r) buzz(r === 'in' ? [40, 30, 80] : 40); return !!r; }
    if (id === 'build') { if (sim.build) buildUi(); return !!sim.build; }
    if (id === 'shop') { if (sim.nearShop) shopUi(); return true; }
    if (id === 'pocket') return sim.usePocket();
    if (id === 'bomb') { const ok = sim.useBomb(); if (ok) buzz([60, 40, 120]); return ok; }
    if (id === 'turret') return sim.useTurret();
    if (id === 'call') { callUi(); return true; }
    return false;
  }
  // ---------- the shop panel ----------
  function shopUi(note) {
    const sim = PH.sim, St = sim && sim.stockOf(); if (!St) return; if (sim.evo) { setOverlay(''); return; }
    const TP = window.TZP, Pl = TP.PLACES[St.type], say = Pl.says[(sim.cell[0] * 3 + sim.cell[1] + sim.wave) % Pl.says.length];
    const goods = St.list.map((id) => { const G = TP.GOODS[id], c = sim.priceOf(id), sold = St.sold[id];
      return `<div class="tz-good ${sold ? 'sold' : ''}"><span class="tz-gi">${G.icon}</span><div><b>${esc(G.name)}</b><small>${esc(G.desc)}</small>${G.kind === 'ability' && !sold ? `<select data-ab="${id}">${W().ABILITIES.map((a) => `<option value="${a.id}">${a.icon} ${esc(a.name)}${sim.ab[a.id] ? ' ×' + sim.ab[a.id] : ''}</option>`).join('')}</select>` : ''}</div><button class="btn small ${sold ? 'ghost' : sim.cash >= c ? 'green' : 'ghost'}" data-buy="${id}" ${sold || sim.cash < c ? 'disabled' : ''}>${sold ? 'Sold' : '$' + c}</button></div>`; }).join('');
    const extra = sim.shopExtra ? sim.shopExtra(St.type) : '';
    const ov = setOverlay(`<div class="tz-shop" style="--pc:${Pl.color}"><div class="tz-shead"><span class="tz-sicon">${Pl.icon}</span><div><h2>${esc(Pl.name)}</h2><p>“${esc(say)}”</p></div><b class="tz-cash">$${sim.cash}</b></div>${note ? `<p class="tz-snote">${esc(note)}</p>` : ''}<div class="tz-goods">${goods}${extra}</div><p class="tz-mut">${sim.mode === 'solo' ? '⏸ The game waits while you shop.' : '🛡️ You can’t be hurt while you shop.'}</p><div class="tz-mbtns"><button class="btn green" data-close>Done ▶</button></div></div>`, 'shop');
    if (!ov) return;
    for (const b of ov.querySelectorAll('[data-buy]')) b.onclick = (e) => { e.stopPropagation(); const id = b.dataset.buy, sel = ov.querySelector(`[data-ab="${id}"]`); const r = sim.buy(id, sel && sel.value); shopUi(r.ok ? '' : r.error); };
    if (sim.shopBind) sim.shopBind(ov, shopUi);
    ov.querySelector('[data-close]').onclick = (e) => { e.stopPropagation(); setOverlay(''); };
  }
  // ---------- call-outs: quick pings + "let's go" to a place the team found ----------
  function callUi() {
    const v = PH.v || {}, TP = window.TZP, sim = PH.sim;
    const places = (v.found || []).map(([k, type]) => { const Pl = TP.PLACES[type], [x, y] = k.split(',').map(Number), d = W().roadDist(v.seed, [sim.cell])[y * W().GRID + x]; return { k, Pl, d }; }).sort((a, b) => a.d - b.d).slice(0, 8);
    const ov = setOverlay(`<div class="tz-call"><h2>📣 Call out to the team</h2><div class="tz-qp">${[['here', '📍 Over here!'], ['health', '❤️ Need health'], ['boss', '☠️ Boss here!'], ['help', '🆘 Come help']].map(([k, l]) => `<button class="btn" data-ping="${k}">${l}</button>`).join('')}${sim.placeType() ? `<button class="btn green" data-ping="place" data-cell="${sim.cellKey()}">${TP.PLACES[sim.placeType()].icon} ${esc(TP.PLACES[sim.placeType()].name)} here!</button>` : ''}</div>${places.length ? `<h3>🧭 Let’s all go to…</h3><div class="tz-qp">${places.map((p) => `<button class="btn ghost small" data-ping="go" data-cell="${p.k}">${p.Pl.icon} ${esc(p.Pl.name)} <small>(${p.d} blocks)</small></button>`).join('')}</div>` : '<p class="tz-mut">Places you find (shops, merchants, the crucible) show up here for the whole team.</p>'}<div class="tz-mbtns"><button class="btn ghost" data-close>Close</button></div></div>`, 'call');
    if (!ov) return;
    for (const b of ov.querySelectorAll('[data-ping]')) b.onclick = async (e) => { e.stopPropagation(); setOverlay(''); const r = await report({ op: 'ping', k: b.dataset.ping, cell: b.dataset.cell }); if (r && r.ok && PH.ctx) PH.ctx.haptic('select'); };
    ov.querySelector('[data-close]').onclick = (e) => { e.stopPropagation(); setOverlay(''); };
  }
  // ---------- a boss map: you choose where it leads ----------
  function mapUi(options) {
    const TP = window.TZP, L = (options || []).slice(0, 4);
    const label = (o) => o.what === 'door' ? ['🚪', 'The boss door', 'A clue to where the lair is'] : o.what === 'stash' ? ['💰', 'A hidden stash', 'Cash buried somewhere in town'] : [TP.PLACES[o.type].icon, TP.PLACES[o.type].name, o.what === 'forge' ? 'Where weapons evolve' : o.what === 'master' ? 'Upgrades weapons Lv 8→10' : 'The nearest one you haven’t found'];
    const ov = setOverlay(`<div class="tz-mapc"><h2>🗺️ The boss dropped a map!</h2><p>Where should it lead? The whole team gets the route.</p><div class="tz-mopts">${L.map((o) => { const [i, n, d] = label(o); return `<button class="tz-mopt" data-what="${o.what}"><span>${i}</span><b>${esc(n)}</b><small>${esc(d)}</small></button>`; }).join('')}</div></div>`, 'map');
    if (!ov) return;
    for (const b of ov.querySelectorAll('[data-what]')) b.onclick = async (e) => { e.stopPropagation(); setOverlay(''); const r = await report({ op: 'reveal', what: b.dataset.what }); if (r && r.ok && PH.ctx) { PH.ctx.haptic('win'); PH.ctx.toast('🗺️ Marked on everyone’s map!'); } };
  }
  // ---------- the route to the newest call-out: an arrow at the exit that leads there ----------
  function route(g, sim, V, txt) {
    const v = PH.v; if (!v || !v.pings || !v.pings.length || sim.phase !== 'play' || !sim.cam) return;
    const q = v.pings[v.pings.length - 1], Z = W(); if (q.x === sim.cell[0] && q.y === sim.cell[1]) return;
    const path = routeCells(Z, v.seed, sim.cell, [q.x, q.y]); if (path.length < 2) return;
    const nx = path[1], dir = nx[0] > sim.cell[0] ? 'e' : nx[0] < sim.cell[0] ? 'w' : nx[1] > sim.cell[1] ? 's' : 'n', road = sim.area.exits[dir]; if (!road) return;
    const ex = dir === 'w' ? 0 : dir === 'e' ? Z.AW : road.p, ey = dir === 'n' ? 0 : dir === 's' ? Z.AH : road.p, C = sim.cam;
    let [sx, sy] = C.toScreen(ex, ey); sx = Math.max(40, Math.min(V.w - 40, sx)); sy = Math.max(110, Math.min(V.h - 60, sy));
    const a = { n: -Math.PI / 2, s: Math.PI / 2, w: Math.PI, e: 0 }[dir], P = q.place && window.TZP.PLACES[q.place];
    g.save(); g.translate(sx, sy); g.rotate(a); g.globalAlpha = 0.7 + 0.3 * Math.sin(sim.t * 6); g.fillStyle = '#ffd23f'; g.strokeStyle = '#1b1410'; g.lineWidth = 3; g.beginPath(); g.moveTo(22, 0); g.lineTo(-12, -16); g.lineTo(-4, 0); g.lineTo(-12, 16); g.closePath(); g.fill(); g.stroke(); g.restore(); g.globalAlpha = 1;
    txt(`🧭 ${q.name || ''}: ${P ? P.icon + ' ' + P.name : q.place === 'stash' ? '💰 stash' : q.place === 'door' ? '🚪 lair' : '📣'} · ${path.length - 1} blocks`, V.w / 2, V.h - 18, Math.min(V.w, V.h) < 420 ? 12 : 14, '#ffd23f', 'center');
  }
  function roundRect(g, x, y, w, h, r) { w = Math.max(0, w); r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function minimap(g, sim, V) {
    const v = PH.v; if (!v) return;
    const Z = W(), N = v.grid || 9, small = Math.min(V.w, V.h) < 420, cs = small ? 11 : 13, mw = N * cs, x0 = V.w - mw - 14, y0 = 62;
    g.fillStyle = 'rgba(15,10,6,0.75)'; roundRect(g, x0 - 5, y0 - 5, mw + 10, mw * 0.6 + 10 + 0, 6); g.fill();
    const ch = cs * 0.6, ex = new Set((v.explored || []).map((e) => e[0] + ',' + e[1]));
    PH.mm = { x: x0 - 5, y: y0 - 5, w: mw + 10, h: N * ch + 10 };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const seen = ex.has(x + ',' + y); g.fillStyle = seen ? lookOf(v, x, y).ground[0] : 'rgba(255,255,255,0.06)'; g.fillRect(x0 + x * cs, y0 + y * ch, cs, ch); }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) roadLines(g, Z, v.seed, x, y, x0 + x * cs, y0 + y * ch, cs, ch, ex.has(x + ',' + y) ? 'rgba(40,40,44,0.95)' : 'rgba(200,200,210,0.18)');
    const S0 = v.story, LK = v.locks;
    if (LK) for (let i = 0; i < N * N; i++) { // locked blocks: red, special ones gold-edged
      const px = x0 + (i % N) * cs, py = y0 + Math.floor(i / N) * ch, kind = LK.kind && LK.kind[i];
      if (LK.req[i] > LK.kills) { g.fillStyle = kind ? 'rgba(200,140,20,0.55)' : 'rgba(200,40,30,0.5)'; g.fillRect(px + 0.5, py + 0.5, cs - 1, ch - 1); }
      if (kind) { g.strokeStyle = '#ffd23f'; g.lineWidth = 1; g.strokeRect(px + 1, py + 1, cs - 2, ch - 2); }
    }
    if (S0) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const px = x0 + x * cs, py = y0 + y * ch, k = x + ',' + y;
      if (S0.plan && S0.plan.finds[k] && ex.has(k) && !(S0.taken || []).includes(k)) { g.fillStyle = '#ffd23f'; g.fillRect(px + cs / 2 - 1.5, py + ch / 2 - 1.5, 3, 3); }
    }
    const TP = window.TZP; g.font = `${small ? 8 : 9}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [k, type] of v.found || []) { const [fx, fy] = k.split(',').map(Number), Pl = TP && TP.PLACES[type]; if (Pl) g.fillText(Pl.icon, x0 + fx * cs + cs / 2, y0 + fy * ch + ch / 2); }
    for (const k of v.stashes || []) { const [fx, fy] = k.split(',').map(Number); g.fillText('💰', x0 + fx * cs + cs / 2, y0 + fy * ch + ch / 2); }
    for (const q of v.pings || []) { const u = (sim.t * 2) % 1; g.strokeStyle = `rgba(255,210,63,${1 - u})`; g.lineWidth = 2; g.beginPath(); g.arc(x0 + q.x * cs + cs / 2, y0 + q.y * ch + ch / 2, 3 + u * 8, 0, TAU); g.stroke(); }
    if (S0 && S0.door) { g.strokeStyle = '#ff5a3c'; g.lineWidth = 2; g.strokeRect(x0 + S0.door[0] * cs, y0 + S0.door[1] * ch, cs, ch); }
    for (const p of v.players || []) { if (p.state === 'dead') continue; g.fillStyle = p.color || '#fff'; g.beginPath(); g.arc(x0 + p.x * cs + cs / 2, y0 + p.y * ch + ch / 2, 3, 0, TAU); g.fill(); }
    if (Math.sin(sim.t * 8) > -0.3) { g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.5; g.beginPath(); g.arc(x0 + sim.cell[0] * cs + cs / 2, y0 + sim.cell[1] * ch + ch / 2, 3.5, 0, TAU); g.fill(); g.stroke(); }
    // the nearest friend: "Ana 2⬆ 1➡"
    let best = null, bd = 99;
    for (const p of v.players || []) { if (p.bot || p.state === 'dead') continue; const d = Math.abs(p.x - sim.cell[0]) + Math.abs(p.y - sim.cell[1]); if (d > 0 && d < bd) { bd = d; best = p; } }
    if (best) {
      const dx = best.x - sim.cell[0], dy = best.y - sim.cell[1], s = (dy ? Math.abs(dy) + (dy < 0 ? '⬆' : '⬇') : '') + (dx ? ' ' + Math.abs(dx) + (dx < 0 ? '⬅' : '➡') : '');
      g.font = 'bold 12px "Lilita One", sans-serif'; g.textAlign = 'right'; g.textBaseline = 'top'; g.lineWidth = 3; g.strokeStyle = '#000'; const label = (best.name || '') + ' ' + s; g.strokeText(label, x0 + mw + 4, y0 + N * ch + 9); g.fillStyle = best.color || '#fff'; g.fillText(label, x0 + mw + 4, y0 + N * ch + 9);
    }
  }
  // ---------- overlays: cards, pause, death ----------
  function setOverlay(html, cls = '') {
    const ov = PH.root && PH.root.querySelector('.tz-ov'); if (!ov) return null;
    if (!html) { ov.hidden = true; ov.className = 'tz-ov'; PH.overlay = ''; return ov; }
    ov.hidden = false; ov.className = 'tz-ov ' + cls; BOX.morph(ov, html); PH.overlay = cls; return ov;
  }
  function cardsUi() {
    const sim = PH.sim; if (!sim || !sim.cards) return;
    const Z = W(), mouse = !isTouch();
    const cards = sim.cards.map((id, i) => {
      if (id === '_snack' && false) return `<button class="tz-card c-def" data-card="${i}"><i>${mouse ? i + 1 : ''}</i><span class="tz-cat">Snack</span><b class="tz-ci">🌭</b><h3>Big Snack</h3><p>You have every ability maxed out! Heal 40.</p></button>`;
      const A = Z.AB[id], cur = sim.ab[id] || 0, C = Z.CATS[A.cat];
      return `<button class="tz-card c-${A.cat}" data-card="${i}"><i>${mouse ? i + 1 : ''}</i><span class="tz-cat" style="background:${C.color}">${C.name}</span><b class="tz-ci">${A.icon}</b><h3>${esc(A.name)}</h3><p>${esc(A.desc)}</p><small>${cur ? `×${cur} → ×${cur + 1}` : `NEW · stacks forever`}</small></button>`;
    }).join('');
    const ov = setOverlay(`<div class="tz-lvl"><h2>LEVEL UP! <span>Lv ${sim.lvl - sim.pendingLevels + 1}</span></h2><p>${sim.mode === 'solo' ? 'The game is paused. Pick one:' : '🛡️ You can’t be hurt while you choose (the game keeps going for your friends).'}</p><div class="tz-cards">${cards}</div></div>`, 'cards');
    if (ov) for (const b of ov.querySelectorAll('[data-card]')) b.onclick = (e) => { e.stopPropagation(); choose(Number(b.dataset.card)); };
  }
  function choose(i) {
    const sim = PH.sim; if (!sim || !sim.cards) return;
    if (sim.pick(i)) { if (PH.ctx) PH.ctx.haptic('select'); if (sim.cards) cardsUi(); else { setOverlay(''); if (sim.setClass && !sim.cls) classUi(); } }
  }
  function buildHtml(ab) {
    const Z = W(), L = Object.entries(ab || {}).filter(([, n]) => n > 0);
    if (!L.length) return '<p class="tz-mut">No abilities yet: level up by grabbing the green XP gems.</p>';
    return ['atk', 'def', 'spc'].map((c) => { const items = L.filter(([id]) => Z.AB[id] && Z.AB[id].cat === c); return items.length ? `<div class="tz-bcat c-${c}"><h4>${Z.CATS[c].name}</h4>${items.map(([id, n]) => `<div class="tz-bi"><span>${Z.AB[id].icon}</span><b>${esc(Z.AB[id].name)}</b><small>×${n}</small></div>`).join('')}</div>` : ''; }).join('');
  }
  function gearHtml(sim) {
    if (!sim._fi) return ''; const R = window.TZR, cls = sim.cls && R.CLASSES[sim.cls];
    const ws = [sim.gun, ...sim.weapons].map((w) => `<span class="tz-wp t${w.tier}">${R.WEAPONS[w.id].icon} <b>${esc(R.wname(w.id, w.tier))}</b> <small>Lv ${w.lv}${w.tier > 1 ? ' · ' + '★'.repeat(w.tier - 1) : ''}</small></span>`).join('');
    const its = Object.entries(sim.items || {}).map(([id, n]) => `<span title="${esc(R.ITEMS[id].desc)}">${R.ITEMS[id].icon} ${esc(R.ITEMS[id].name)}${n > 1 ? ' ×' + n : ''}</span>`).join('');
    const book = R.COMBOS.map((C) => sim.combos.has(C.id) ? `<span class="tz-cb on" title="${esc(C.desc)}">${C.icon} <b>${esc(C.name)}</b><small>${esc(C.desc)}</small></span>` : '<span class="tz-cb">❔ <b>???</b><small>Not discovered yet</small></span>').join('');
    return `${cls ? `<p class="tz-mut">${cls.icon} <b>${cls.name}</b>: ${esc(cls.desc)}</p>` : ''}<h3>Weapons <small>(${sim.weapons.length}/${R.SLOTS} slots · 🔥 ${sim.cores} cores)</small></h3><div class="tz-finds">${ws}</div>${its ? `<h3>Items</h3><div class="tz-finds">${its}</div>` : ''}<h3>🧪 Combo book <small>(${sim.combos.size}/${R.COMBOS.length})</small></h3><div class="tz-book">${book}</div>`;
  }
  // ---------- the survivor class (picked at the start of a run) ----------
  function classUi() {
    const sim = PH.sim, R = window.TZR; if (!sim || sim.cls || sim.dead || PH.overlay === 'class') return;
    const owned = (sim.load && sim.load.classes) || [], party = !!(PH.v && PH.v.party), can = (id) => !R.CLASSES[id].locked || owned.includes(id);
    const ov = setOverlay(`<div class="tz-class"><h2>Pick your survivor</h2><div class="tz-clist">${Object.entries(R.CLASSES).filter(([id, C]) => can(id) || !party).map(([id, C]) => can(id) ? `<button class="tz-copt ${C.locked ? 'unl' : ''}" data-cls="${id}"><span>${C.icon}</span><b>${esc(C.name)}</b><small>${esc(C.desc)}</small></button>` : `<button class="tz-copt locked" disabled><span>🔒</span><b>${esc(C.name)}</b><small>Unlock it with scrap (pause menu → 🔓 Unlocks)</small></button>`).join('')}</div>${party ? '<p class="tz-mut">🎉 Party Mode: everyone starts equal (no unlocks).</p>' : ''}<p class="tz-mut">${sim.mode === 'solo' ? 'The game waits.' : 'You can’t be hurt while you pick.'}</p></div>`, 'class');
    if (!ov) return;
    const pick = (id) => { if (sim.setClass(id)) { setOverlay(''); if (PH.ctx) PH.ctx.haptic('select'); } };
    for (const b of ov.querySelectorAll('[data-cls]')) b.onclick = (e) => { e.stopPropagation(); pick(b.dataset.cls); };
    clearTimeout(PH.clsT); PH.clsT = setTimeout(() => { if (PH.sim === sim && !sim.cls && PH.overlay === 'class') { const L = Object.keys(R.CLASSES).filter(can); pick(L[Math.floor(Math.random() * L.length)]); } }, 25000);
  }
  function toggleMenu(force) {
    const sim = PH.sim; if (!sim || sim.dead) return;
    if (sim.cards) return;
    PH.menu = force != null ? force : !PH.menu;
    if (!PH.menu) { setOverlay(''); return; }
    const v = PH.v || {}, vip = PH.view && PH.view.vip, touch = isTouch();
    const ov = setOverlay(`<div class="tz-menu"><h2>${sim.mode === 'solo' ? '⏸ Paused' : '🤝 Co-op: the game keeps going!'}</h2>
      <div class="tz-mstats"><span>Wave <b>${sim.wave}</b></span><span>Level <b>${sim.lvl}</b></span><span>Kills <b>${sim.killCount}</b></span><span>📍 ${esc(sim.area.biome.name)}</span></div>
      <h3>Your build</h3><div class="tz-build">${buildHtml(sim.ab)}</div>${gearHtml(sim)}${Object.keys(sim.eq || {}).length ? `<h3>Your finds</h3><div class="tz-finds">${Object.keys(sim.eq).map((id) => { const F = window.TZS.FINDS[id]; return F ? `<span title="${esc(F.desc)}">${F.icon} ${esc(F.name)}</span>` : ''; }).join('')}</div>` : ''}${sim.story ? `<p class="tz-mut">📖 Regular: 🗝️ ${sim.story.keys}/3 key pieces · 🗺️ ${sim.story.maps}/2 map halves${sim.story.boss ? ` · ${sim.story.boss.icon} ${esc(sim.story.boss.name)} waits behind the door` : ''}</p>` : ''}${!isFull() && !standalone() && isTouch() && (canFull() || isIOS()) ? '<button class="btn ghost small" data-opt="fs">⛶ Full screen</button>' : ''}
      <div class="tz-opts"><button class="btn small ${sim.set.aim !== 'off' ? 'green' : 'ghost'}" data-opt="aim">🎯 Auto-aim: ${sim.set.aim !== 'off' ? 'On' : 'Off'}</button><button class="btn small ${PH.vib ? 'green' : 'ghost'}" data-opt="vib">📳 Buzz: ${PH.vib ? 'On' : 'Off'}</button><button class="btn small ghost" data-opt="gfx">🎨 Graphics: ${PH.gfxPref === 'auto' ? 'Auto (' + (gfxHi() ? 'High' : 'Low') + ')' : gfxHi() ? 'High' : 'Low'}</button></div>
      <div class="tz-controls">${touch ? '👆 Drag anywhere to move · 🔴 the stick bottom-right aims and shoots · auto-aim shoots the nearest zombie when you let go.' : '⌨️ WASD / arrows move · 🖱️ mouse aims · hold left click (or Space) to shoot · E grabs a pickup · F (or click) opens a chest · M town map · 1 2 3 pick cards · Esc pauses.'}</div>
      <details class="tz-cred"><summary>🎨 Credits: CC0 art + sound packs</summary>${creditsHtml()}</details>
      <div class="tz-mbtns"><button class="btn green big" data-opt="resume">▶ Keep playing</button><button class="btn ghost small" data-opt="unl">🔓 Unlocks (🔩 ${(PH.view && PH.view.meta && PH.view.meta.scrap) || 0})</button>${vip ? '<button class="btn ghost small" data-opt="end">🏁 End the night (results)</button>' : ''}</div></div>`, 'menu');
    if (!ov) return;
    for (const b of ov.querySelectorAll('[data-opt]')) b.onclick = async (e) => {
      e.stopPropagation(); const o = b.dataset.opt;
      if (o === 'resume') return toggleMenu(false);
      if (o === 'unl') { PH.menu = false; return unlockUi(); }
      if (o === 'fs') { if (isIOS()) { toggleMenu(false); iosHint(true); return; } goFull(); return toggleMenu(true); }
      if (o === 'gfx') { PH.gfxPref = { auto: 'high', high: 'low', low: 'auto' }[PH.gfxPref] || 'auto'; try { localStorage.setItem('tz.gfx', PH.gfxPref); } catch { /* private */ } return toggleMenu(true); }
      if (o === 'aim') { sim.set.aim = sim.set.aim !== 'off' ? 'off' : 'on'; PH.aimPref = sim.set.aim; return toggleMenu(true); }
      if (o === 'vib') { PH.vib = !PH.vib; try { localStorage.setItem('tz.vib', PH.vib ? '1' : '0'); } catch { /* private */ } return toggleMenu(true); }
      if (o === 'end') { if (b.dataset.armed) { await report({ op: 'end' }); toggleMenu(false); } else { b.dataset.armed = '1'; b.textContent = 'Tap again to end for everyone'; } }
    };
  }
  function overlay() {
    const v = PH.v; if (!v || !PH.root) return;
    const me = v.me || {};
    if (me.state === 'dead' || (PH.sim && PH.sim.dead)) {
      const d = PH.dead || { wave: me.wave, kills: me.kills, lvl: me.lvl, ab: me.ab };
      const vip = PH.view && PH.view.vip, best = me.best;
      const body = BOX.body ? BOX.body({ id: me.id, name: PH.view && PH.view.me.name, bot: true }, 150, { mood: 'sad' }) : '';
      const ov = setOverlay(`<div class="tz-dead"><div class="tz-dbody">${body}</div><div class="tz-dmain"><h2>YOU GOT TRASHED</h2>
        <div class="tz-mstats"><span>Wave <b>${d.wave}</b></span><span>Kills <b>${d.kills}</b></span><span>Level <b>${d.lvl}</b></span></div>
        ${best && (best.wave > d.wave || (best.wave === d.wave && best.kills > d.kills)) ? `<p class="tz-mut">Best tonight: wave ${best.wave}, ${best.kills} kills</p>` : ''}
        <div class="tz-build">${buildHtml(d.ab)}</div>
        ${v.mode === 'score' ? `<p class="tz-mut">Score attack: you lose 15% of your points for falling. ${me.reviveIn > 0 ? `Back in <b>${Math.ceil(me.reviveIn / 1000)} s</b> at your garage.` : 'Back in at your garage, with your build.'}</p>` : ''}
        ${v.story ? `<p class="tz-mut">${v.story.reviveIn > 0 ? `Your friends are still fighting. Back in <b>${Math.ceil(v.story.reviveIn / 1000)} s</b> at your garage, with your build.` : 'Back in at your garage, with your whole build.'}</p>` : ''}
        ${helperHtml(v)}
        <div class="tz-mbtns"><button class="btn green big" data-again ${(v.story && v.story.reviveIn > 0) || me.reviveIn > 0 ? 'disabled' : ''}>${v.story || v.mode === 'score' ? '🔁 Back in' : '🔁 Play again'}${isTouch() ? '' : ' (Enter)'}</button>${vip ? '<button class="btn ghost small" data-end>🏁 End the night</button>' : ''}</div></div></div>`, 'dead');
      if (!ov) return;
      const a = ov.querySelector('[data-again]'); if (a) a.onclick = async () => { a.disabled = true; const r = await report({ op: 'respawn' }); if (!r.ok) a.disabled = false; };
      const e = ov.querySelector('[data-end]'); if (e) e.onclick = async () => { if (e.dataset.armed) await report({ op: 'end' }); else { e.dataset.armed = '1'; e.textContent = 'Tap again to end for everyone'; } };
      helperBind(ov, (m) => report({ op: 'help', ...m }));
    }
  }
  // ---------- phase 3 HUD: weather, the horde night, your ride, the survivor you escort, the TV ----------
  function hud3(g, sim, V, txt) {
    const X = window.TZX; if (!X || !sim._mo) return; const w = V.w, h = V.h, small = Math.min(w, h) < 420, rx = w - 14; let ry = small ? 152 : 168;
    const Wd = X.WEATHER[sim.wxk]; if (Wd && sim.wxk !== 'clear') { txt(Wd.icon + ' ' + Wd.name, rx, ry, small ? 13 : 15, '#bfe3ff', 'right'); ry += 18; if (sim.wxT > 0 || small === false) { txt(Wd.tip, rx, ry, small ? 10 : 12, 'rgba(230,240,255,0.85)', 'right'); ry += 18; } }
    if (sim.spotOn) { g.globalAlpha = 0.6 + 0.4 * Math.sin(sim.t * 5); txt('📺 You’re on the TV!', rx, ry, small ? 12 : 14, '#ff8c6a', 'right'); g.globalAlpha = 1; ry += 20; }
    const N = sim.npc; if (N) { txt('🧍 ' + N.name + ' ' + Math.max(0, Math.round((100 * N.hp) / N.mhp)) + '% → a shop or 🏥', rx, ry, small ? 12 : 14, '#ffe066', 'right'); ry += 20; }
    const G = sim.gd, b = sim.build;
    if (G && G.phase !== 'explore') {
      const ty = small ? 98 : 114; txt(G.phase === 'build' ? '🔨 BUILD · horde in ' + Math.ceil((G.endsIn || 0) / 1000) + 's' : '🧟 HORDE NIGHT ' + G.night, w / 2, ty, small ? 15 : 18, G.phase === 'build' ? '#ffb02e' : '#ff6a4a', 'center');
      txt('Hope ' + '❤️'.repeat(G.hope || 0) + '🖤'.repeat(Math.max(0, (G.max || 3) - (G.hope || 0))), w / 2, ty + (small ? 18 : 22), small ? 11 : 13, '#fff', 'center');
      if (b) { const bw = Math.min(220, w * 0.3), bx = (w - bw) / 2, by = ty + (small ? 32 : 38), fr = Math.max(0, b.door.hp / b.door.mhp); g.fillStyle = 'rgba(15,10,6,0.8)'; roundRect(g, bx - 3, by - 3, bw + 6, 14, 6); g.fill(); g.fillStyle = fr < 0.3 ? '#ff4a3a' : '#ffd23f'; roundRect(g, bx, by, bw * fr, 8, 4); g.fill(); txt('🚪', bx - 16, by + 4, 13, '#fff', 'center'); }
    } else if (G && G.phase === 'explore') txt('🏚️ Horde night ' + (G.night + 1) + ' at wave ' + G.next, w / 2, small ? 98 : 114, small ? 11 : 13, '#ffe9a8', 'center');
    if (sim.down) txt('🙌 Tap HELP (or H): help the team while you wait', w / 2, h * 0.4 + (small ? 60 : 72), small ? 12 : 14, '#ffe9a8', 'center');
  }
  // ---------- Garage Defense: the build panel ----------
  function buildUi(note) {
    const sim = PH.sim, X = window.TZX; if (!sim || !sim.build || sim.dead) { if (PH.overlay === 'build') setOverlay(''); return; }
    const b = sim.build, G = (PH.v && PH.v.garage) || {}, D = b.door, meId = PH.v && PH.v.me && PH.v.me.id, ready = (G.ready || []).includes(meId);
    const counts = {}; for (const it of b.items) counts[it.k] = (counts[it.k] || 0) + 1;
    const items = Object.entries(X.BUILD).map(([k, B]) => { const c = X.buildCost(k, b.night), ok = sim.cash >= c && !(k === 'repair' && D.hp >= D.mhp); return `<div class="tz-good"><span class="tz-gi">${B.icon}</span><div><b>${esc(B.name)}${counts[k] ? ' ×' + counts[k] : ''}</b><small>${esc(B.desc)}</small></div><button class="btn small ${ok ? 'green' : 'ghost'}" data-bld="${k}" ${ok ? '' : 'disabled'}>$${c}</button></div>`; }).join('');
    PH.buildNote = note || '';
    const ov = setOverlay(`<div class="tz-shop tz-bld" style="--pc:#ffb02e"><div class="tz-shead"><span class="tz-sicon">🔨</span><div><h2>Horde night ${b.night}: build!</h2><p>${G.phase === 'build' ? `The horde comes in <b>${timer(G.endsIn || 0)}</b>.` : '🧟 The horde is here: you can still build.'} Each thing goes down where you stand: walk around your yard, then buy.</p></div><b class="tz-cash">$${sim.cash}</b></div>${note ? `<p class="tz-snote">${esc(note)}</p>` : ''}<div class="tz-gstat"><span>🚪 Door ${Math.ceil(D.hp)}/${D.mhp}</span><span>Hope ${'❤️'.repeat(G.hope || 0)}</span><span>🏚️ Night ${b.night}</span></div><div class="tz-goods">${items}</div><div class="tz-mbtns">${G.phase === 'build' ? `<button class="btn ${ready ? 'ghost' : 'green'}" data-ready ${ready ? 'disabled' : ''}>${ready ? '✅ Ready: waiting for the others' : '✅ Ready for the horde'}</button>` : ''}<button class="btn ghost" data-close>Walk around ▶</button></div></div>`, 'build');
    if (!ov) return;
    for (const btn of ov.querySelectorAll('[data-bld]')) btn.onclick = (e) => { e.stopPropagation(); const r = sim.buildBuy(btn.dataset.bld); if (r.ok && PH.ctx) PH.ctx.haptic('select'); buildUi(r.ok ? '' : r.error); };
    const rd = ov.querySelector('[data-ready]'); if (rd) rd.onclick = async (e) => { e.stopPropagation(); rd.disabled = true; const r = await report({ op: 'ready' }); if (r && r.ok && PH.ctx) PH.ctx.haptic('success'); };
    ov.querySelector('[data-close]').onclick = (e) => { e.stopPropagation(); setOverlay(''); };
  }
  // ---------- helpers (down, out or watching): crates, the event vote, a horde at the leader ----------
  function helperHtml(v, aud) {
    const X = window.TZX, me = v.me || {}, H = me.helper; if (!H || !X) return '';
    const mates = (v.players || []).filter((p) => !p.bot && p.state === 'play' && p.id !== me.id), P = v.poll, L = v.leader, C = X.HELP;
    const mine = P && (P.mine || (H.voted && H.voted !== true ? H.voted : null));
    return `<div class="tz-help ${aud ? 'aud' : ''}"><h3>🙌 Help from the sidelines <span class="tz-en"><i style="width:${Math.round((100 * H.e) / H.max)}%"></i><b>⚡ ${H.e}/${H.max}</b></span></h3>
      <div class="tz-hrow"><b>📦 Drop a supply crate</b><small>${C.crate.cost} ⚡ · health, cash and a power-up${H.crateIn > 0 ? ' · ready in ' + Math.ceil(H.crateIn / 1000) + ' s' : ''}</small><div class="tz-hbtns">${mates.length ? mates.map((p) => { const ok = H.e >= C.crate.cost && !(H.crateIn > 0); return `<button class="btn small ${ok ? 'green' : 'ghost'}" data-crate="${esc(p.id)}" ${ok ? '' : 'disabled'}>${face(p, 22)} ${nm(p.name)}</button>`; }).join('') : '<small class="tz-mut">Nobody is fighting right now.</small>'}</div></div>
      ${P ? `<div class="tz-hrow"><b>🗳️ Vote: the next area event</b><small>${C.vote.cost} ⚡ · closes in ${timer(P.endsIn)}</small><div class="tz-hbtns">${P.opts.map((k) => `<button class="btn small ${mine === k ? 'green' : 'ghost'}" data-hvote="${k}" ${mine || H.e < C.vote.cost ? 'disabled' : ''}>${X.VOTE_EVENTS[k].icon} ${esc(X.VOTE_EVENTS[k].name)} <em>${P.counts[k] || 0}</em></button>`).join('')}</div></div>` : '<div class="tz-hrow"><b>🗳️ Event vote</b><small>The next vote opens soon.</small></div>'}
      ${v.mode === 'score' ? (() => { const ok = L && L.id !== me.id && H.e >= C.horde.cost && !(H.hordeIn > 0); return `<div class="tz-hrow"><b>🧟 Send a horde at the leader${L ? ': ' + nm(L.name) : ''}</b><small>${C.horde.cost} ⚡${H.hordeIn > 0 ? ' · ready in ' + Math.ceil(H.hordeIn / 1000) + ' s' : ''}</small><div class="tz-hbtns"><button class="btn small ${ok ? 'red' : 'ghost'}" data-hhorde ${ok ? '' : 'disabled'}>🧟 Send it!</button></div></div>`; })() : ''}</div>`;
  }
  function helperBind(root, act, after) {
    const done = (r) => { if (r && r.ok) { if (PH.ctx) PH.ctx.haptic('success'); if (after) after(r); } };
    for (const b of root.querySelectorAll('[data-crate]')) b.onclick = async (e) => { e.stopPropagation(); b.disabled = true; done(await act({ k: 'crate', to: b.dataset.crate })); };
    for (const b of root.querySelectorAll('[data-hvote]')) b.onclick = async (e) => { e.stopPropagation(); b.disabled = true; done(await act({ k: 'vote', ev: b.dataset.hvote })); };
    const hb = root.querySelector('[data-hhorde]'); if (hb) hb.onclick = async (e) => { e.stopPropagation(); hb.disabled = true; done(await act({ k: 'horde' })); };
  }
  function helperUi() {
    const v = PH.v; if (!v || !PH.sim || !PH.sim.down) { if (PH.overlay === 'helper') setOverlay(''); return; }
    const ov = setOverlay(`<div class="tz-menu tz-helpov"><h2>🆘 You’re down: help out!</h2>${helperHtml(v) || '<p class="tz-mut">Hang on…</p>'}<div class="tz-mbtns"><button class="btn ghost" data-close>Back</button></div></div>`, 'helper');
    if (!ov) return; helperBind(ov, (m) => report({ op: 'help', ...m })); ov.querySelector('[data-close]').onclick = (e) => { e.stopPropagation(); setOverlay(''); };
  }
  // ---------- unlocks that carry over (scrap, kept on your profile) ----------
  function unlockHtml(meta, party) {
    const X = window.TZX; if (!X) return ''; meta = meta || { guest: true, scrap: 0, own: [], pick: {} };
    const own = new Set(meta.own || []), pick = meta.pick || {};
    const sec = (kind, title) => `<h3>${title}</h3><div class="tz-ulist">${X.UNLOCKS.filter((u) => u.kind === kind).map((u) => { const has = own.has(u.id), on = kind !== 'cls' && pick[kind] === u.key, needs = u.needs && !own.has(u.needs);
      return `<div class="tz-unl ${has ? 'own' : ''} ${on ? 'on' : ''}"><span class="tz-gi">${u.icon}</span><div><b>${esc(u.name)}</b><small>${esc(u.desc)}</small></div>${has ? (kind === 'cls' ? '<em>✅ Yours</em>' : `<button class="btn small ${on ? 'green' : 'ghost'}" data-upick="${kind}" data-uid="${on ? '' : u.key}">${on ? '✓ On' : 'Use'}</button>`) : `<button class="btn small ${!meta.guest && meta.scrap >= u.cost && !needs ? 'green' : 'ghost'}" data-ubuy="${u.id}" ${meta.guest || meta.scrap < u.cost || needs ? 'disabled' : ''}>🔩 ${u.cost}</button>`}</div>`; }).join('')}</div>`;
    return `<div class="tz-unlocks"><div class="tz-shead"><span class="tz-sicon">🔓</span><div><h2>Unlocks</h2><p>${meta.guest ? 'Make your character (🛍️) to keep scrap between nights.' : 'Scrap comes from every night you play (not in Party Mode). Unlocks stay yours.'}</p></div><b class="tz-cash">🔩 ${meta.scrap || 0}</b></div>${party ? '<p class="tz-snote">🎉 Party Mode: everyone starts equal, so unlocks are off for this game (and it pays no scrap).</p>' : ''}${sec('cls', '🧑 New survivor classes')}${sec('wp', '🔫 Starting weapon (pick one)')}${sec('fit', '🎩 Outfits (pick one)')}${sec('tier', '😈 Harder tiers (more scrap)')}</div>`;
  }
  function unlockBind(root, after) {
    const go = async (m) => { const r = await (PH.ctx ? PH.ctx.act({ op: 'meta', ...m }) : Promise.resolve({ ok: false })); if (r && r.ok) { if (PH.view) PH.view.meta = r.meta; if (PH.ctx) PH.ctx.haptic('success'); } if (after) after(r); };
    for (const b of root.querySelectorAll('[data-ubuy]')) b.onclick = (e) => { e.stopPropagation(); b.disabled = true; go({ k: 'buy', id: b.dataset.ubuy }); };
    for (const b of root.querySelectorAll('[data-upick]')) b.onclick = (e) => { e.stopPropagation(); go({ k: 'pick', slot: b.dataset.upick, id: b.dataset.uid || null }); };
  }
  function unlockUi() {
    const ov = setOverlay(`<div class="tz-shop tz-unlov">${unlockHtml(PH.view && PH.view.meta, PH.v && PH.v.party)}<p class="tz-mut">New picks start with your next run.</p><div class="tz-mbtns"><button class="btn green" data-close>Done ▶</button></div></div>`, 'unlocks');
    if (!ov) return; unlockBind(ov, () => unlockUi()); ov.querySelector('[data-close]').onclick = (e) => { e.stopPropagation(); setOverlay(''); };
  }
  // ---------- the run save: reloading the page puts you back with your cash, weapons and items ----------
  const runStoreKey = () => { const code = (PH.view && PH.view.code) || '', id = PH.v && PH.v.me && PH.v.me.id; return code && id ? 'tz.run.' + code + '.' + id : null; };
  function saveRun() {
    PH.saveAt = performance.now(); const sim = PH.sim, v = PH.v, k = runStoreKey(); if (!sim || !v || !v.me || !k || !sim.saveData || sim.dead || sim.phase === 'intro') return;
    try { localStorage.setItem(k, JSON.stringify({ rk: runKey(v.me), seed: v.seed, d: sim.saveData() })); } catch { /* full or private */ }
  }
  function loadRun(v) {
    const k = runStoreKey(); if (!k) return null;
    try { const s = JSON.parse(localStorage.getItem(k) || 'null'); if (!s || s.seed !== v.seed || s.rk !== runKey(v.me) || !s.d) return null; return s.d; } catch { return null; }
  }
  function dropRun() { const k = runStoreKey(); try { if (k) localStorage.removeItem(k); for (let i = localStorage.length - 1; i >= 0; i--) { const kk = localStorage.key(i); if (!kk || !kk.startsWith('tz.run.')) continue; const s = JSON.parse(localStorage.getItem(kk) || 'null'); if (!s || !s.d || Date.now() - (s.d.at || 0) > 86400000) localStorage.removeItem(kk); } } catch { /* fine */ } }
  if (!PH.saveBound) { PH.saveBound = true; window.addEventListener('pagehide', () => saveRun()); document.addEventListener('visibilitychange', () => { if (document.hidden) saveRun(); }); }
  // ---------- the ice-cream truck's jingle (an original little tune) ----------
  let AC = null;
  function jingle() {
    try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch { return; }
    const notes = [72, 76, 79, 76, 77, 74, 71, 74, 72], t0 = AC.currentTime + 0.05;
    notes.forEach((n, i) => { const o = AC.createOscillator(), g = AC.createGain(); o.type = i % 2 ? 'triangle' : 'square'; o.frequency.value = 440 * Math.pow(2, (n - 69) / 12); g.gain.setValueAtTime(0.0001, t0 + i * 0.16); g.gain.exponentialRampToValueAtTime(0.06, t0 + i * 0.16 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.16 + 0.15); o.connect(g); g.connect(AC.destination); o.start(t0 + i * 0.16); o.stop(t0 + i * 0.16 + 0.17); });
  }
  function debugApi() {
    return {
      sim: () => PH.sim, frames: () => ({ dt: PH.frames.slice(), work: PH.work.slice(), quality: PH.quality }),
      spawn(n, type) { const s = PH.sim; for (let i = 0; i < n; i++) s.spawnOne(type); return s.z.length; },
      give(k) { PH.sim.applyPickup(k); return true; }, drop(k) { const s = PH.sim; s.pk.push({ id: s.pkid++, k, x: s.p.x + 60, y: s.p.y, life: 20 }); return true; },
      xp(n) { PH.sim.gainXp(n); return PH.sim.lvl; }, skip() { const s = PH.sim; if (s.phase === 'intro') s.introT = 99; return true; },
      clear() { const s = PH.sim; s.z.length = 0; s.waveKills = s.spec.target; s.bossDue = false; return true; },
      god(on) { PH.sim.p.inv = on ? 1e9 : 0; return true; }, kill() { const s = PH.sim; s.p.inv = 0; s.buffs.shield = 0; s.p.armor = 0; s.p.lives = 0; s.p.hp = 1; s.hurt(999); return s.dead; },
      walk(dir) { const s = PH.sim; s.cleared = true; s.leave(dir); return s.cell.join(','); },
      teleport(x, y) { const s = PH.sim; s.p.x = x; s.p.y = y; return true; },
      kills(n) { PH.sim.killCount += n; PH.sim.reportStatus(true); return PH.sim.killCount; },
      story: () => PH.v && PH.v.story, pv: () => PH.v,
      jump(type) { const s = PH.sim, e = Object.entries(window.TZP.places(s.seed)).find(([, t]) => t === type); if (!e) return false; const [x, y] = e[0].split(',').map(Number); s.enterArea(x, y, null, false); s.startWave(); s.z.length = 0; s.waveKills = s.spec.target; s.bossDue = false; return e[0]; },
      classUi() { PH.sim.cls = null; PH.overlay = ''; classUi(); return PH.overlay; }, weapon(id) { return PH.sim.addWeapon(id); }, wlv(id, lv) { const w = PH.sim.weaponById(id); w.lv = lv; PH.sim.stats(); return true; }, cores(n) { PH.sim.cores += n; return PH.sim.cores; },
      evolveNow(id) { const s = PH.sim, w = s.weaponById(id); w.lv = 10; s.cores += 1; s.evo = { t: 0, id, from: w.tier, to: w.tier + 1, done: false }; return true; }, evoT(t) { if (PH.sim.evo) PH.sim.evo.t = t; return !!PH.sim.evo; },
      debuff(k) { return PH.sim.applyDebuff(k); }, cls(id) { return PH.sim.setClass(id); }, event(k) { PH.sim.startEvent(k); return true; },
      carrier(type) { const s = PH.sim, z = s.spawnOne(type || 'walker'); z.carry = 'rockets'; z.x = s.p.x + 220; z.y = s.p.y; return z.id; },
      cash(n) { const s = PH.sim; s.cash = (s.cash || 0) + n; return s.cash; },
      place() { return PH.sim.placeType(); }, shop() { const s = PH.sim, D = s.shopDoor(); if (!D) return false; s.cleared = true; s.p.x = D.x; s.p.y = D.y + 10; button('shop'); return PH.overlay; },
      btn(id) { return button(id); }, overlay: () => PH.overlay,
      weather(tod, rain, fog) { const s = PH.sim; s._wx = { tod, rain: !!rain, fog: !!fog }; return true; },
      async goTo(x, y) { const wait = (ms) => new Promise((r) => setTimeout(r, ms)); for (let i = 0; i < 30; i++) { const s = PH.sim; if (s.cell[0] === x && s.cell[1] === y) return true; const dirs = []; if (s.cell[0] < x) dirs.push('e'); if (s.cell[0] > x) dirs.push('w'); if (s.cell[1] < y) dirs.push('s'); if (s.cell[1] > y) dirs.push('n'); const d = dirs.find((q) => !s.gateLeft(q)) || dirs[0]; if (s.gateLeft(d)) return 'locked ' + d; s.z.length = 0; s.waveKills = s.spec.target; s.bossDue = false; s.cleared = true; s.leave(d); await wait(450); while (PH.sim.cards) { PH.sim.pick(0); } } return false; },
      boss(key) { const s = PH.sim; s.z = s.z.filter((z) => !z.fb); s.finalSpawned = false; s.finalDead = false; s.story.plan.boss = key; s.spawnFinal(); return true; },

      stick() { const c = PH.cv; return stickZone({ w: c.clientWidth, h: c.clientHeight }); }, device: () => PH.device, menu: () => PH.menu,
      wx(k) { PH.sim.setWeather(k, true); return PH.sim.wxk; }, park(kind) { const s = PH.sim; s.parked = { kind, x: s.p.x + 60, y: s.p.y, hp: window.TZX.VEHICLES[kind].hp, mhp: window.TZX.VEHICLES[kind].hp, face: 1 }; return true; }, ride: () => PH.sim.toggleRide(),
      hide() { const s = PH.sim; s.hiding = { id: s.cellKey(), name: 'Old Gus', color: '#e8b830', x: s.p.x + 80, y: s.p.y + 10, hp: 120, mhp: 120, face: -1 }; return true; }, npc() { const s = PH.sim; s.npc = { id: s.cellKey(), name: 'Nana Pearl', color: '#c37bff', x: s.p.x - 60, y: s.p.y + 20, hp: 90, mhp: 120, follow: true }; return true; },
      crate() { PH.sim.gift({ kind: 'crate', from: 'Dee' }); return PH.sim.crates.length; }, landCrates() { for (const c of PH.sim.crates) c.t = c.land; return true; },
      garage(phase, night) { PH.sim.setGarage({ phase, night: night || 1, endsIn: 30000, hope: 3, max: 3, next: 5, ready: [], done: [] }); return !!PH.sim.build; }, buildBuy(k) { return PH.sim.buildBuy(k); }, buildUi() { buildUi(); return PH.overlay; },
      bossKey(key) { const s = PH.sim; s.z = s.z.filter((z) => !z.mb); const z = s.makeZ(key, s.p.x + 300, s.p.y - 100); z.mb = key; z.cd = 2; z.cd2 = 4; return z.id; },
      spot(on) { PH.sim.spotOn = !!on; return true; }, save() { saveRun(); return PH.sim.saveData(); }, helperUi() { helperUi(); return PH.overlay; }, unlockUi() { unlockUi(); return PH.overlay; }, fit(f) { PH.sim.fit = f; return true; },
      intro() { const s = PH.sim; if (!s.area.garage) return false; s.phase = 'intro'; s.introT = 0; s.p.x = s.area.garage.x + s.area.garage.w / 2; s.p.y = s.area.garage.y + 120; s.banner = null; return true; },
    };
  }

  // The CC0 art and sound packs (full list with links: public/box/games/trash-assets/CREDITS.md)
  const CREDITS = [
    ['Quaternius', 'Zombie Apocalypse Kit, Toon Shooter Game Kit, Ultimate Monsters, Ultimate Animated Character Pack, Stylized Nature MegaKit, single models on poly.pizza'], ['KayKit (Kay Lousberg)', 'City Builder Bits, RPG Tools Bits, Resource Bits, Skeletons'],
    ['Kenney', 'Car Kit, City Kits (Commercial, Industrial, Suburban), Retro Urban, Furniture, Food, Blaster, Mini Market, Smoke Particles, Particle Pack, Impact / Interface / Sci-fi / RPG / Digital Audio, Music Jingles'], ['ambientCG', 'ground textures'],
    ['OpenGameArt.org', 'The Free Firearm Sound Library, Gunshots (kurt), Zombie noises (ianzazz), Zombie moans + Hungry ghoul (Darsycho), Zombies Sound Pack (artisticdude), Rain (Ylmir), engine loops (domasx2), Blood Splatter (Sinestesia)'],
  ];
  const creditsHtml = () => `<ul class="jz-credits">${CREDITS.map(([a, b]) => `<li><b>${esc(a)}</b>: ${esc(b)}</li>`).join('')}<li>All CC0 (public domain). Thank you! Vehicles, the garage door and a few props are our own models.</li></ul>`;
  // The title screen at /zombies: the town at dusk in the iso art (TZI.showcase), the logo and a start button.
  function titleScreen(el, { start, back, resume, code }) {
    const G = BOX.games.trash;
    el.innerHTML = `<div class="jz-title"><canvas id="jz-title-cv"></canvas><div class="jz-title-card">
      <div class="jz-logo"><span class="a">Just</span><span class="b">Zombies</span></div>
      <p class="jz-tag">Roll up the garage door. The whole town is trash, and the trash is walking.</p>
      ${resume ? `<button class="jz-go" id="jz-resume">▶ Back to town ${esc(code || '')}</button>` : ''}<button class="jz-go ${resume ? 'alt' : ''}" id="jz-go">🧟 Roll up the door</button>
      <div class="jz-row"><button class="jz-small" id="jz-how-b">How to play</button><button class="jz-small" id="jz-cred-b">Credits</button><button class="jz-small" id="jz-back">◀ JustGameBox</button></div>
      <ol class="jz-how" id="jz-how" hidden>${G.how.map((h) => `<li>${esc(h)}</li>`).join('')}</ol><div id="jz-cred" hidden>${creditsHtml()}</div>
      <p class="jz-fine">Open this on the TV; everyone plays on their phone (or a computer). Solo or 1–100 players, best with 1–4.</p></div></div>`;
    el.querySelector('#jz-go').onclick = start; const rs = el.querySelector('#jz-resume'); if (rs) rs.onclick = resume; el.querySelector('#jz-back').onclick = back;
    el.querySelector('#jz-how-b').onclick = () => { const h = el.querySelector('#jz-how'); h.hidden = !h.hidden; el.querySelector('#jz-cred').hidden = true; };
    el.querySelector('#jz-cred-b').onclick = () => { const h = el.querySelector('#jz-cred'); h.hidden = !h.hidden; el.querySelector('#jz-how').hidden = true; };
    const cv = el.querySelector('#jz-title-cv'), t0 = performance.now(); if (window.TZI) TZI.boot(null, { keys: window.TZI.SHOW_KEYS });
    const step = () => { if (!document.body.contains(cv)) return; const W = cv.clientWidth, H = cv.clientHeight, d = Math.min(1.5, window.devicePixelRatio || 1); if (cv.width !== Math.round(W * d) || cv.height !== Math.round(H * d)) { cv.width = Math.round(W * d); cv.height = Math.round(H * d); }
      const g = cv.getContext('2d'); if (window.TZI && TZI.ready && TZI.showcase) TZI.showcase(g, W, H, d, (performance.now() - t0) / 1000, { title: true }); else { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#0c0a08'; g.fillRect(0, 0, cv.width, cv.height); }
      requestAnimationFrame(step); };
    step();
  }
  BOX.games.trash = {
    name: 'JustZombies', icon: '🧟',
    // a big game with its own address (/zombies) and title screen; /box/tv?game=trash still works (small-game frame)
    standalone: true, smallToo: true, path: 'zombies', title: titleScreen, credits: CREDITS,
    about: 'Roll up the garage door and blast your way through an endless zombie town, level up, build your loadout, and find your friends on the map.',
    how: [
      'Your PHONE is the whole game: turn it sideways. Drag anywhere to move; the small stick bottom-right aims and shoots. Auto-aim shoots the nearest zombie while you just move.',
      'On a computer: WASD or arrows to move, the mouse to aim, hold left click to shoot, Esc to pause.',
      'Kill zombies, grab the green XP gems and level up: pick 1 of 3 abilities (Attack, Defense or Special). They stack!',
      'Glowing pickups give a quick boost: Bubble Shield, Trash-Can Armor, Buzzsaw Minigun, Rocket Sneakers, Garbage Day, Freezer Burn, Health Snack, Double XP.',
      'Clear the wave and the exits open: walk out an edge into a brand-new area for the next, tougher wave. Every 5th wave a Dumpster Brute shows up.',
      'Between waves you get a short break (30 seconds, the big countdown): shop, heal or walk on. When it hits zero the next wave comes to you, wherever you stand.',
      'The TV shows the town map. Walk into a friend’s area to team up: you share the zombies (and the XP).',
      'Locked gates (every mode): blocks of town open as the TEAM’s zombie kills rise. Each locked gate and the map show “🔒 120 / 200 kills”. ⭐ Special blocks (the best shops, zombie dens, loot stashes, key vaults, the boss lair) need many more kills and hide tougher zombies and elites. A locked gate is never the only way: there’s always another road. Tap the minimap (or M) for the town map.',
      'Chests: clear the area, walk up to the chest and tap OPEN (on a computer: click it, or F). Loot stashes and dens hide loot chests with cash and goodies for everyone.',
      'Regular mode: the 3 key pieces sit in chests in locked key vaults; other chests hold unique gear, abilities and map halves. Find the hidden boss door, open it with the whole key and beat the boss to win. Endless mode: waves forever, and the far gates keep climbing.',
      'Abilities never max out: pick them again and again and they keep stacking.',
      'Pick a survivor class at the start. Zombies drop cash: spend it at the places you find in town (market, army surplus, clinic). The Tinkerer, the Gunsmith and the rare Master Armorer level your weapons up to 10; the far-off Crucible evolves a level-10 weapon (bosses drop the cores it needs).',
      'Extra weapons fire by themselves. Own the right pair and they combine. Some zombies carry a super weapon: take them out and it’s yours for a few seconds.',
      'Later waves bring nasty zombies that blind you, web you (wiggle to break free), jam your guns or flip your controls. The clinic cleans you up.',
      '📣 Call out to the team: places you find show up for everyone, with the route along the streets. Score attack (and Party Mode): the highest score wins; keep the kill streak going for a bigger multiplier.',
      'Garage Defense: every 5 waves a horde night pulls everyone home. Build barricades, turrets, spike strips, sprinkler-flamers and car-alarm decoys, then hold the door. Broken doors cost the town hope.',
      'Hop into shopping carts, push mowers and ride-on mowers (V or the button), grab the rare garbage truck or the even rarer tank. Every ride is on a clock (the ring over it): when it runs out, or it gets wrecked, you hop out. Escort hiding survivors to a shop or the clinic. Rain, fog and heat waves change the fight.',
      'Down, out or just watching? Your phone helps: drop supply crates, vote on the next event, or (Score attack) send a horde at the leader. Scrap from every night unlocks classes, starting weapons, outfits and harder tiers (not in Party Mode).',
    ],
    fx: { start: 'start' },
    // ---------------- lobby ----------------
    lobbyTv(el, L) {
      if (!el.querySelector('.tz-lobby')) {
        el.innerHTML = `<div class="tz-lobby"><div class="tz-lb-sky"></div><div class="tz-lb-door"><div class="tz-lb-slats"></div><span>No. 13</span></div>
          <div class="tz-lb-main"><h1 class="tz-logo">Just<b>Zombies</b></h1><p class="tz-tag">Roll up the garage. Walk out. Don’t get trashed.</p>
          <div class="tz-lb-row"><div class="tz-join"><img id="qr" alt="QR code to join"><div class="tz-code-l">Room code</div><div class="tz-code" id="code"></div><div class="tz-url">or go to <b id="url"></b></div><small>Your phone is the controller AND the screen</small></div>
          <div class="tz-lb-set"><h3>🛠️ House rules</h3><div class="tz-settings" id="settings"></div></div></div>
          <div class="tz-roster" id="roster"></div><div class="tz-err" id="lobby-err"></div>
          <button class="btn big tz-start" id="start">Roll up the door ▶</button>
          <div class="tz-links"><button class="link" id="add-bots">+ 5 test bots</button> <button class="link" id="pick">🎮 Another game</button></div></div></div>`;
        el.querySelector('#start').onclick = async () => { const r = await L.start(); el.querySelector('#lobby-err').textContent = r && r.ok ? '' : (r && r.error) || ''; };
        el.querySelector('#add-bots').onclick = () => L.bots(5);
        el.querySelector('#pick').onclick = () => L.pick();
      }
      el.querySelector('#code').textContent = L.code; const u = el.querySelector('#url'); if (u) u.textContent = String(L.joinUrl || '').replace(/^https?:\/\//, '');
      const q = el.querySelector('#qr'); if (q.dataset.u !== L.qr) { q.src = L.qr; q.dataset.u = L.qr; }
      const set = el.querySelector('#settings'), sig = JSON.stringify(L.settings);
      if (set.dataset.sig !== sig && !set.contains(document.activeElement)) {
        set.dataset.sig = sig;
        set.innerHTML = L.fields.map((f) => `<label>${esc(f.label)}<select data-set="${esc(f.key)}">${f.options.map((o) => `<option value="${esc(String(o.value))}" ${String(L.settings[f.key]) === String(o.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`).join('');
        for (const s of set.querySelectorAll('[data-set]')) s.onchange = () => L.set(s.dataset.set, s.value);
      }
      BOX.morph(el.querySelector('#roster'), L.players.map((p) => `<span class="chip">${face({ ...p, bot: true }, 30)} ${nm(p.name)}</span>`).join('') || '<span class="muted">Scan the code to join! Solo works great too.</span>');
    },
    // ---------------- TV ----------------
    tv(el, s) {
      if (!s) return;
      TV.s = s;
      if (s.phase === 'over') { cancelAnimationFrame(TV.raf); TV.raf = 0; TV.el = null; return tvOver(el, s); }
      if (!el.querySelector('.tz-tv')) { el.innerHTML = '<div class="tz-tv"><div class="tz-mapw"><canvas id="tz-map"></canvas><div class="tz-maptag">🗺️ The town · walk into a friend’s area to team up</div><div id="tz-spot"></div><div class="tz-cards" id="tz-cards"></div></div><aside class="tz-side" id="tz-side"></aside></div>'; TV.el = el; tvLoop(); }
      TV.el = el; if (!TV.raf) tvLoop();
      BOX.morph(el.querySelector('#tz-side'), tvSide(s));
      const spw = el.querySelector('#tz-spot'), sig = s.spot ? s.spot.id + ':' + s.spot.why + ':' + Math.round(s.spot.hp) : ''; if (spw.dataset.sig !== sig) { spw.dataset.sig = sig; if (!s.spot) spw.innerHTML = ''; else if (!spw.querySelector('#tz-spotc')) spw.innerHTML = spotHtml(s); else BOX.morph(spw.querySelector('.tz-spot-tag'), spotTag(s.spot)); spw.firstElementChild && spw.firstElementChild.classList.toggle('down', !!(s.spot && s.spot.why === 'down')); }
      BOX.morph(el.querySelector('#tz-cards'), tvCards(s));
    },
    onFx(f) {
      const s = TV.s;
      if (f.kind === 'tzgarage') { TV.anims.push({ x: f.x, y: f.y, t0: performance.now() / 1000 }); clip('bid/garage-rollup.webm', { vol: 0.45 }) || BOX.sfx('creak'); }
      else if (f.kind === 'tzpick') { (BOX.audio && BOX.audio.stinger && BOX.audio.stinger('lvl', 'trash')) || BOX.sfx('chime'); }
      else if (f.kind === 'tzpickup') { if (f.pk === 'nuke') { BOX.sfx('explosion'); } else if (f.pk === 'freeze') BOX.sfx('freeze'); else if (f.pk === 'shield') BOX.sfx('shield'); else BOX.sfx('pop'); }
      else if (f.kind === 'tzboss') { clip('zombie/groan-' + (1 + Math.floor(Math.random() * 3)) + '.ogg', { vol: 0.6 }) || BOX.sfx('roar'); }
      else if (f.kind === 'tzdead') { clip('zombie/body-fall.ogg', { vol: 0.4 }) || BOX.sfx('fall'); }
      else if (f.kind === 'tzclear') { BOX.sfx('reveal'); }
      else if (f.kind === 'tzcoop') { BOX.sfx('join'); }
      else if (f.kind === 'tzunlock') { clip('zombie/barricade.ogg', { vol: 0.6 }) || BOX.sfx('explosion'); BOX.sfx('reveal'); }
      else if (f.kind === 'tzfind') { BOX.sfx('chime'); }
      else if (f.kind === 'tzevolve') { TV.flash = { x: f.x, y: f.y, t0: performance.now() / 1000 }; BOX.sfx('reveal'); BOX.sfx('chime'); }
      else if (f.kind === 'tzcombo') { BOX.sfx('chime'); }
      else if (f.kind === 'tzping') { BOX.sfx('pop'); }
      else if (f.kind === 'tzplace' || f.kind === 'tzmap') { BOX.sfx('reveal'); }
      else if (f.kind === 'tzdown') { clip('zombie/groan-1.ogg', { vol: 0.4 }) || BOX.sfx('fall'); }
      else if (f.kind === 'tzdoorfound') { BOX.sfx('ominous'); }
      else if (f.kind === 'tzdoor') { BOX.sfx('roar'); clip('zombie/thunder.ogg', { vol: 0.5 }); }
      else if (f.kind === 'tzcard') { if (f.key === 'icecream') jingle(); else BOX.sfx('ominous'); }
      else if (f.kind === 'tzrecap') { BOX.sfx('reveal'); }
      else if (f.kind === 'tzweather') { BOX.sfx(f.k === 'rain' ? 'whoosh' : 'reveal'); }
      else if (f.kind === 'tzhorde') { if (f.phase === 'horde') { BOX.sfx('roar'); clip('zombie/groan-2.ogg', { vol: 0.6 }); } else BOX.sfx('siren'); }
      else if (f.kind === 'tzbroke') { BOX.sfx('crunch'); BOX.sfx('explosion'); }
      else if (f.kind === 'tzdawn' || f.kind === 'tzrescue' || f.kind === 'tzvote') { BOX.sfx('chime'); }
      else if (f.kind === 'tzcrate' || f.kind === 'tzsent') { BOX.sfx('pop'); }
      void s;
    },
    music(s) { if (!s) return 'play'; if (s.phase === 'over') return s.why === 'lost' || s.why === 'overrun' ? 'lose' : 'finale'; if (s.story && s.story.doorOpen) return 'action'; if (s.garage && s.garage.phase === 'horde') return 'action'; if (s.garage && s.garage.phase === 'build') return 'tense'; const P = s.players || []; if (P.length && P.every((p) => p.state === 'dead')) return 'lose'; return P.some((p) => p.wave % 5 === 0 && p.state !== 'dead' && !p.bot) ? 'tense' : 'play'; },
    // ---------------- phone ----------------
    phone(el, v, ctx, view) {
      if (!v) return;
      PH.ctx = ctx; PH.view = view || PH.view; PH.v = v;
      for (const p of v.players || []) PH.people.set(p.id, p);
      if (view && view.me) PH.people.set(view.me.id, view.me);
      if (v.phase === 'over') {
        if (PH.root) { dropRun(); if (window.TZSnd) TZSnd.stopAll(); PH.root = null; PH.sim = null; cancelAnimationFrame(PH.raf); document.body.classList.remove('tz-playing'); }
        const st = v.standings || [], i = st.findIndex((r) => r.id === (v.me && v.me.id)), r = st[i] || {};
        const won = v.why === 'win', lost = v.why === 'lost';
        BOX.morph(el, `<div class="card-box tz-ph-over ${won ? 'won' : ''}">${won ? '<div class="tz-confetti"></div><h2 class="tz-win">🏆 YOU WIN!</h2>' : lost ? '<h2 class="tz-lose">💀 The trash won…</h2>' : ''}<h2 class="tz-logo sm">Just<b>Zombies</b></h2>${won && v.story ? `<p>${v.story.boss ? esc(v.story.boss.name) + ' is down' : 'The boss is down'} in <b>${BOX.mmss ? BOX.mmss(v.story.time) : Math.round(v.story.time / 60000) + ' min'}</b> · ${v.story.kills} team kills · ${v.story.finds.length} finds</p>` : ''}<div class="tz-pbig">${BOX.body ? BOX.body({ id: v.me && v.me.id, bot: true }, 130, { mood: i === 0 ? 'grin' : 'smile' }) : ''}</div>
          <h3>${i === 0 ? '🏆 Top survivor!' : `#${i + 1} of ${st.length}`}</h3>${r.score ? `<p class="tz-bigsc">${r.score.toLocaleString('en-US')} points</p>` : ''}<p>Best run: wave <b>${r.wave || 1}</b> · ${r.kills || 0} kills · level ${r.lvl || 1}</p><div class="tz-ab">${abIcons(r.build)}</div>
          <ol class="tz-mini">${st.slice(0, 6).map((x) => `<li>${face(x, 26)} <b>${nm(x.name)}</b> <span>W${x.wave} · ${x.kills}k</span></li>`).join('')}</ol>
          <div class="tz-scrapbox">${v.party ? '<p>🎉 Party Mode: no scrap this time (everyone starts equal).</p>' : v.me && v.me.scrap != null ? `<p class="tz-bigsc">🔩 +${v.me.scrap} scrap${v.me.scrapGuest ? '' : ' saved to your profile'}</p>${v.me.scrapGuest ? '<p class="tz-mut">Make your character (🛍️) to keep scrap next time.</p>' : ''}` : ''}<button class="btn ghost small" data-unl>🔓 Unlocks (🔩 ${(view && view.meta && view.meta.scrap) || 0})</button><div class="tz-unlbox">${PH.overUnl ? unlockHtml(view && view.meta, false) : ''}</div></div></div>`);
        { const ub = el.querySelector('[data-unl]'); if (ub) ub.onclick = () => { PH.overUnl = !PH.overUnl; BOX.morph(el.querySelector('.tz-unlbox'), PH.overUnl ? unlockHtml(PH.view && PH.view.meta, false) : ''); unlockBind(el.querySelector('.tz-unlbox'), () => { BOX.morph(el.querySelector('.tz-unlbox'), unlockHtml(PH.view && PH.view.meta, false)); unlockBind(el.querySelector('.tz-unlbox')); }); }; if (PH.overUnl) unlockBind(el.querySelector('.tz-unlbox')); }
        if (!PH.overHaptic) { PH.overHaptic = true; ctx.haptic('win'); }
        return;
      }
      PH.overHaptic = false;
      if (!v.me) { BOX.morph(el, '<div class="card-box"><h3>Joining the night…</h3></div>'); return; }
      ensureRoot(el);
      radio(v);
      if (v.me.state === 'dead' && (!PH.sim || PH.sim.dead || PH.run !== runKey(v.me))) { if (!PH.sim || PH.run !== runKey(v.me)) { PH.sim = null; PH.run = runKey(v.me); } overlay(); return; }
      if (!PH.sim || PH.run !== runKey(v.me)) { setOverlay(''); PH.menu = false; newSim(v); }
      else if (v.area && PH.sim) PH.sim.setArea(v.area);
      if (PH.sim) { PH.sim.homes = v.homes || PH.sim.homes; PH.sim.setStory(v.story, v.me); if (PH.sim.setWorld) PH.sim.setWorld(v); }
      if (PH.overlay === 'build') buildUi(PH.buildNote); else if (PH.overlay === 'helper') helperUi();
      fsButton();
      if (PH.sim && PH.sim.cards && PH.overlay !== 'cards') cardsUi();
    },
    live(m) { if (PH.sim) PH.sim.onLive(m); },
    tvLive,
    // ---------------- watching on a phone: the helper panel (play.js audience screen) ----------------
    audience(st) { const gv = st.gv; if (!gv || gv.phase !== 'play') return ''; return `<div class="card-box tz-help-aud">${helperHtml({ me: { id: null, helper: PH.audHelper || { e: 0, max: 100, crateIn: 0, hordeIn: 0 } }, players: gv.players, poll: gv.poll, leader: gv.leader, mode: gv.mode }, true)}</div>`; },
    audienceBind(root, st, act, ui) {
      const box = root.querySelector('.tz-help-aud'); if (!box) return;
      const redraw = () => { const gv = st.gv; if (!gv) return; BOX.morph(box, helperHtml({ me: { id: null, helper: PH.audHelper }, players: gv.players, poll: gv.poll, leader: gv.leader, mode: gv.mode }, true)); helperBind(box, act, (r) => { if (r.me) { PH.audHelper = r.me; redraw(); } }); };
      helperBind(box, act, (r) => { if (r.me) { PH.audHelper = r.me; redraw(); } });
      if (!PH.audAt || Date.now() - PH.audAt > 2000) { PH.audAt = Date.now(); act({ k: 'state' }).then((r) => { if (r && r.ok && r.me) { PH.audHelper = r.me; redraw(); } else if (r && r.error && ui && ui.toast && !PH.audErr) { PH.audErr = true; } }); }
    },
    // ---------------- the lobby: your scrap and unlocks ----------------
    lobby(view) { const M = view && view.meta; if (!M) return ''; return `<div class="card-box tz-lobmeta"><div class="tz-lobrow"><b>🔩 ${M.scrap || 0} scrap</b><button class="btn small ghost" data-lobunl>🔓 Unlocks & loadout</button></div><div class="tz-lobunl">${PH.lobUnl ? unlockHtml(M, false) : ''}</div></div>`; },
    lobbyBind(el, view, ctx) {
      PH.ctx = ctx; PH.view = view; const b = el.querySelector('[data-lobunl]'); if (!b) return; const box = el.querySelector('.tz-lobunl');
      const draw = () => { BOX.morph(box, PH.lobUnl ? unlockHtml(PH.view && PH.view.meta, false) : ''); unlockBind(box, draw); };
      b.onclick = () => { PH.lobUnl = !PH.lobUnl; draw(); }; if (PH.lobUnl) unlockBind(box, draw);
    },
  };
})();
