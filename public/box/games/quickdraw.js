'use strict';
// Quick Draw: TV and phone screens, the designed lobby (a saloon wall), haptics and the shared
// western art (BOX.qdArt, also used by the title screen and the intro).
// TIMING: the TV and every phone estimate the server clock with a few pings (phone op 'ping',
// TV host action 'qdPing'; the quickest round trip wins) and show every signal at its server
// time. Phones stamp each tap on the server clock, so lag never decides a duel.
// TV: a canvas street scene (data-keep, drawn every frame from the synced clock) under an HTML
// overlay (BOX.morph). Phone: a big tap pad inside a data-keep element, driven by its own loop.
(function () {
  const { esc } = BOX;
  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const easeOut = (k) => 1 - Math.pow(1 - clamp(k), 3);
  const back = (k) => { k = clamp(k); const c = 2.2; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
  const L = () => (performance.timeOrigin || 0) + performance.now(); // local clock (ms since epoch, monotonic)
  const av = (r) => esc((r && r.avatar) || '🙂');
  const secs = (ms) => (ms / 1000).toFixed(3) + 's';
  const KIND = {
    draw: { icon: '🔫', name: 'DRAW!', rule: 'Wait for the signal, then tap first. Tap early and it’s a false start!', phone: 'Tap the instant it says DRAW!', pal: 'noon' },
    flash: { icon: '🏮', name: 'The Lantern', rule: 'Tap ONLY when the lantern turns GREEN. Every decoy you tap costs you.', phone: 'Eyes on the TV. Tap on GREEN only!', pal: 'dusk' },
    count: { icon: '🐔', name: 'Chicken Run', rule: 'Count the 🐔 chickens crossing Main Street. Ducks, turkeys and rabbits don’t count!', phone: 'Tap +1 for every 🐔, then lock in.', pal: 'morning' },
    shake: { icon: '🐎', name: 'Stampede', rule: 'Shake your phone (or mash the pad) to gallop your horse to the finish!', phone: 'SHAKE! Or mash the pad.', pal: 'sunset' },
    copy: { icon: '🥁', name: 'Copycat', rule: 'Listen to the drum, then tap the same rhythm back.', phone: 'Listen… then tap it back.', pal: 'night' },
  };
  const ord = (n) => n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');
  const medal = (r) => ['🥇', '🥈', '🥉'][r] || `#${r + 1}`;
  const sting = (name, fb) => { let ok = false; try { ok = !!(BOX.audio && BOX.audio.stinger(name, 'quickdraw')); } catch { ok = false; } if (!ok && fb) BOX.sfx(fb); };

  // ---------------------------------------------------------------- clock sync
  const SYNC = { off: null, rtt: Infinity, busy: false, at: 0 };
  function seedClock(serverNow) { if (SYNC.rtt === Infinity && typeof serverNow === 'number') SYNC.off = serverNow - L(); }
  async function runSync(send) {
    if (SYNC.busy) return; SYNC.busy = true; SYNC.at = Date.now();
    let best = null;
    for (let i = 0; i < 6; i++) {
      const t0 = L(); let r = null;
      try { r = await Promise.race([send(), new Promise((res) => setTimeout(() => res(null), 1500))]); } catch { r = null; }
      const t1 = L();
      if (r && r.ok && typeof r.now === 'number') { const rtt = t1 - t0; if (!best || rtt < best.rtt) best = { rtt, off: r.now - (t0 + rtt / 2) }; }
      await new Promise((res) => setTimeout(res, 80));
    }
    if (best) { SYNC.off = best.off; SYNC.rtt = best.rtt; }
    SYNC.busy = false;
  }
  const maybeSync = (send) => { if (!SYNC.busy && (SYNC.rtt === Infinity || Date.now() - SYNC.at > 25000)) runSync(send); };
  const toLocal = (ts) => ts - (SYNC.off || 0);
  const toServer = (tl) => tl + (SYNC.off || 0);

  // ---------------------------------------------------------------- western art (canvas)
  const ART = (() => {
    const EMO = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
    const cache = new Map();
    function emoji(g, e, x, y, px, flip) {
      px = Math.max(8, Math.round(px)); const k = e + '|' + px; let c = cache.get(k);
      if (!c) {
        c = document.createElement('canvas'); const s = Math.ceil(px * 1.4); c.width = c.height = s;
        const cg = c.getContext('2d'); cg.font = `${px}px ${EMO}`; cg.textAlign = 'center'; cg.textBaseline = 'middle'; cg.fillText(e, s / 2, s / 2 + px * 0.06);
        cache.set(k, c); if (cache.size > 300) cache.delete(cache.keys().next().value);
      }
      g.save(); g.translate(x, y); if (flip) g.scale(-1, 1); g.drawImage(c, -c.width / 2, -c.height / 2); g.restore();
    }
    function text(g, s, x, y, px, fill, o = {}) {
      g.save(); g.font = `${o.weight || ''} ${px}px ${o.font || '"Lilita One", sans-serif'}`; g.textAlign = o.align || 'center'; g.textBaseline = 'middle';
      if (o.max) { const w = g.measureText(s).width; if (w > o.max) { g.translate(x, y); g.scale(o.max / w, 1); x = 0; y = 0; } }
      if (o.stroke) { g.lineJoin = 'round'; g.lineWidth = o.lw || px * 0.16; g.strokeStyle = o.stroke; g.strokeText(s, x, y); }
      if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = px * 0.5; }
      g.fillStyle = fill; g.fillText(s, x, y); g.restore();
    }
    function rr(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
    const PAL = {
      noon: { sky: ['#3d9be0', '#8fd0f2', '#ffe7ad'], sun: '#fffbe0', lift: 0.78, mesa: ['#cf7449', '#a85634'], ground: ['#efc07e', '#cf914f'], road: 'rgba(255,240,205,0.35)', win: '#3a2a20' },
      dusk: { sky: ['#150c2e', '#4d2358', '#d65f3c'], sun: '#ffb04a', lift: 0.04, mesa: ['#45203a', '#2a1226'], ground: ['#6e4234', '#3b2320'], road: 'rgba(255,190,140,0.12)', win: '#ffcf6b', stars: 0.5 },
      night: { sky: ['#050818', '#111538', '#29214d'], sun: '#f4f1d0', lift: 0.72, moon: true, mesa: ['#1d1733', '#110d20'], ground: ['#352838', '#1d1622'], road: 'rgba(200,190,255,0.08)', win: '#ffcf6b', stars: 1 },
      morning: { sky: ['#ff9f8a', '#ffd3a1', '#fff2cf'], sun: '#fff4c0', lift: 0.3, mesa: ['#e0956a', '#c0714e'], ground: ['#f3cb92', '#dba66a'], road: 'rgba(255,248,225,0.4)', win: '#4a3426' },
      sunset: { sky: ['#2f1745', '#b8443a', '#ffbd5a'], sun: '#ffe08a', lift: 0.14, mesa: ['#6b2a2e', '#481a22'], ground: ['#c9824a', '#8f5530'], road: 'rgba(255,220,170,0.25)', win: '#ffcf6b', stars: 0.15 },
    };
    const MESA = [[0, 0.05], [0.06, 0.12], [0.1, 0.12], [0.13, 0.04], [0.22, 0.03], [0.27, 0.16], [0.36, 0.16], [0.4, 0.06], [0.52, 0.02], [0.6, 0.09], [0.64, 0.09], [0.67, 0.03], [0.76, 0.05], [0.8, 0.14], [0.9, 0.14], [0.94, 0.04], [1, 0.06]];
    const SIGNS = [['SALOON', '#b8402a'], ['BANK', '#2f6b4a'], ['SHERIFF', '#2f4f8a'], ['GENERAL STORE', '#8a5a2b'], ['HOTEL', '#7a2f5a'], ['BARBER', '#2b6c7a']];
    function building(g, x, y, w, h, sign, P, t, k) {
      const wood = ['#8a5531', '#6f4226', '#9a6a3a'][k % 3];
      g.fillStyle = wood; g.fillRect(x, y - h, w, h);
      g.fillStyle = 'rgba(0,0,0,0.15)'; for (let yy = y - h + 10; yy < y; yy += 14) g.fillRect(x, yy, w, 2);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, y - h, w, 8);
      // windows
      const lit = P.win; g.fillStyle = lit;
      for (let i = 0; i < 2; i++) { const wx = x + w * (0.18 + i * 0.44), wy = y - h * 0.62; g.fillRect(wx, wy, w * 0.2, h * 0.18); }
      g.fillStyle = '#2a170c'; g.fillRect(x + w * 0.38, y - h * 0.32, w * 0.24, h * 0.32); // door
      // porch roof
      g.fillStyle = '#4a2a14'; g.fillRect(x - 6, y - h * 0.4, w + 12, 8);
      g.fillRect(x + 2, y - h * 0.4, 5, h * 0.4); g.fillRect(x + w - 7, y - h * 0.4, 5, h * 0.4);
      // sign
      const sw = Math.min(w * 0.86, sign[0].length * h * 0.07 + 30);
      g.fillStyle = sign[1]; rr(g, x + (w - sw) / 2, y - h * 0.92, sw, h * 0.14, 6); g.fill();
      g.strokeStyle = '#f3dfb3'; g.lineWidth = 2; g.stroke();
      text(g, sign[0], x + w / 2, y - h * 0.85, h * 0.085, '#f8ead0', { font: '"Abril Fatface", serif', max: sw - 12 });
    }
    function tumbleweed(g, x, y, r, rot) {
      g.save(); g.translate(x, y); g.rotate(rot); g.strokeStyle = 'rgba(120,80,40,0.9)'; g.lineWidth = Math.max(1.5, r * 0.08);
      for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(0, 0, r, r * (0.35 + (i % 3) * 0.2), (i / 9) * Math.PI, 0, TAU); g.stroke(); }
      g.restore();
    }
    function scene(g, W, H, t, pal, o = {}) {
      const P = PAL[pal] || PAL.sunset, hz = H * (o.horizon || 0.55);
      let gr = g.createLinearGradient(0, 0, 0, hz); gr.addColorStop(0, P.sky[0]); gr.addColorStop(0.62, P.sky[1]); gr.addColorStop(1, P.sky[2]); g.fillStyle = gr; g.fillRect(0, 0, W, hz + 2);
      if (P.stars) for (let i = 0; i < 90; i++) { const x = (i * 197.31) % W, y = (i * 83.77) % (hz * 0.85); g.globalAlpha = P.stars * (0.35 + 0.35 * Math.sin(t * 1.7 + i)); g.fillStyle = '#fff'; g.fillRect(x, y, 2, 2); }
      g.globalAlpha = 1;
      // sun or moon
      const sr = H * 0.12, sx = W * (o.sunX || 0.5), sy = hz - P.lift * hz * 0.85 - sr * 0.15;
      gr = g.createRadialGradient(sx, sy, sr * 0.3, sx, sy, sr * 3.2); gr.addColorStop(0, P.moon ? 'rgba(240,240,210,0.35)' : 'rgba(255,240,180,0.55)'); gr.addColorStop(1, 'rgba(255,240,180,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, hz);
      g.fillStyle = P.sun; g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.fill();
      if (P.moon) { g.fillStyle = 'rgba(30,30,60,0.25)'; g.beginPath(); g.arc(sx - sr * 0.3, sy - sr * 0.2, sr * 0.18, 0, TAU); g.arc(sx + sr * 0.25, sy + sr * 0.3, sr * 0.12, 0, TAU); g.fill(); }
      else if (P.lift < 0.35) { g.fillStyle = P.sky[2]; for (let i = 0; i < 4; i++) g.fillRect(sx - sr, sy + sr * (0.25 + i * 0.2), sr * 2, sr * (0.04 + i * 0.03)); }
      // clouds
      g.fillStyle = P.moon ? 'rgba(120,120,180,0.18)' : 'rgba(255,245,230,0.55)';
      for (let i = 0; i < 4; i++) { const cx = ((i * 0.31 + t * 0.006 * (1 + i * 0.3)) % 1.3 - 0.15) * W, cy = hz * (0.15 + i * 0.12), cw = W * (0.08 + (i % 2) * 0.05); g.beginPath(); g.ellipse(cx, cy, cw, cw * 0.18, 0, 0, TAU); g.ellipse(cx + cw * 0.4, cy - cw * 0.08, cw * 0.5, cw * 0.18, 0, 0, TAU); g.fill(); }
      // mesas: two layers
      for (const [li, col] of [[0, P.mesa[0]], [1, P.mesa[1]]]) {
        g.fillStyle = col; g.beginPath(); g.moveTo(0, hz + 2);
        const sh = li ? 0.37 : 0;
        for (const [u, hh] of MESA) g.lineTo(((u + sh) % 1.0001) * W, hz - hh * H * (li ? 0.55 : 0.85));
        g.lineTo(W, hz + 2); g.closePath(); g.fill();
      }
      // ground and the road
      gr = g.createLinearGradient(0, hz, 0, H); gr.addColorStop(0, P.ground[0]); gr.addColorStop(1, P.ground[1]); g.fillStyle = gr; g.fillRect(0, hz, W, H - hz);
      g.fillStyle = P.road; g.beginPath(); g.moveTo(W * 0.47, hz); g.lineTo(W * 0.53, hz); g.lineTo(W * 0.95, H); g.lineTo(W * 0.05, H); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(80,40,20,0.18)'; g.lineWidth = 3;
      for (const u of [0.38, 0.62]) { g.beginPath(); g.moveTo(W * (0.5 + (u - 0.5) * 0.12), hz); g.lineTo(W * u, H); g.stroke(); }
      // the town
      if (o.town !== false) {
        const bh = H * 0.3;
        [[0, 0.11, 0], [0.105, 0.1, 1], [0.79, 0.105, 2], [0.89, 0.12, 3]].forEach(([u, w, k]) => building(g, u * W, hz + H * 0.07, w * W, bh * (0.85 + (k % 2) * 0.2), SIGNS[(k + (o.signs || 0)) % SIGNS.length], P, t, k));
        g.fillStyle = 'rgba(60,30,10,0.3)'; g.fillRect(0, hz + H * 0.07, W * 0.215, 6); g.fillRect(W * 0.79, hz + H * 0.07, W * 0.21, 6);
      }
      // drifting dust
      g.fillStyle = 'rgba(255,230,190,0.25)';
      for (let i = 0; i < 26; i++) { const x = ((i * 0.137 + t * 0.03 * (1 + (i % 4))) % 1) * W, y = hz + ((i * 0.293) % 1) * (H - hz); g.beginPath(); g.arc(x, y + Math.sin(t * 2 + i) * 4, 1.5 + (i % 3), 0, TAU); g.fill(); }
      // a tumbleweed now and then
      if (o.weed !== false) { const per = 14, k = (t % per) / per, x = lerp(-0.15, 1.15, k) * W, r = H * 0.035; tumbleweed(g, x, hz + H * 0.32 - Math.abs(Math.sin(t * 3.2)) * H * 0.04, r, t * 4); }
      return hz;
    }
    // A cowboy silhouette (feet at x,y; h tall; dir 1 faces right). arm 0 holstered → 1 aimed.
    function cowboy(g, x, y, h, dir, o = {}) {
      const ink = o.ink || '#1d100a';
      g.save(); g.translate(x, y); g.scale(dir * h / 200, h / 200);
      if (o.fall) g.rotate(-o.fall * 1.35);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(0, 2, 46, 8, 0, 0, TAU); g.fill();
      g.fillStyle = ink;
      g.beginPath(); g.moveTo(-20, 0); g.lineTo(-12, -92); g.lineTo(-1, -92); g.lineTo(-6, 0); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(20, 0); g.lineTo(12, -92); g.lineTo(1, -92); g.lineTo(6, 0); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(-34, -70); g.quadraticCurveTo(-30, -120, -24, -148); g.lineTo(24, -148); g.quadraticCurveTo(30, -120, 34, -70); g.closePath(); g.fill(); // duster
      g.fillStyle = o.band || '#c0392b'; g.beginPath(); g.moveTo(-14, -150); g.lineTo(14, -150); g.lineTo(0, -132); g.closePath(); g.fill();
      g.fillStyle = ink; g.beginPath(); g.arc(0, -166, 15, 0, TAU); g.fill();
      if (o.hat !== false) { rr(g, -16, -200, 32, 24, 8); g.fill(); g.beginPath(); g.ellipse(0, -180, 40, 7, 0, 0, TAU); g.fill(); }
      // gun arm
      const a = lerp(1.4, -0.05, clamp(o.arm || 0)), sx = 12, sy = -138, ex = sx + Math.cos(a) * 58, ey = sy + Math.sin(a) * 58;
      g.strokeStyle = ink; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke();
      g.save(); g.translate(ex, ey); g.rotate(a); g.fillRect(0, -5, 26, 8); g.fillRect(2, 0, 7, 14); g.restore();
      if (o.flash) { g.save(); g.translate(ex + Math.cos(a) * 30, ey + Math.sin(a) * 30); g.fillStyle = `rgba(255,220,90,${o.flash})`; g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 10 : 30, q = (i / 10) * TAU; g.lineTo(Math.cos(q) * r, Math.sin(q) * r); } g.fill(); g.restore(); }
      // other arm
      g.beginPath(); g.moveTo(-12, -138); g.lineTo(-22, -96); g.stroke();
      g.restore();
    }
    function lantern(g, x, y, R, col, lit, word, t) {
      g.save();
      g.strokeStyle = '#2a1a10'; g.lineWidth = R * 0.06; g.beginPath(); g.moveTo(x, y - R * 2.2); g.lineTo(x, y - R * 1.15); g.stroke();
      g.fillStyle = '#2a1a10'; rr(g, x - R * 0.55, y - R * 1.25, R * 1.1, R * 0.22, R * 0.08); g.fill();
      if (lit) { const gr = g.createRadialGradient(x, y, R * 0.4, x, y, R * 3.4); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = 0.55; g.fillStyle = gr; g.beginPath(); g.arc(x, y, R * 3.4, 0, TAU); g.fill(); g.globalAlpha = 1; }
      g.fillStyle = '#3b2616'; g.beginPath(); g.arc(x, y, R * 1.08, 0, TAU); g.fill();
      g.fillStyle = lit ? col : `rgba(70,60,60,${0.85 + 0.05 * Math.sin(t * 9)})`; g.beginPath(); g.arc(x, y, R, 0, TAU); g.fill();
      if (lit) { g.fillStyle = 'rgba(255,255,255,0.28)'; g.beginPath(); g.ellipse(x - R * 0.35, y - R * 0.4, R * 0.35, R * 0.2, -0.6, 0, TAU); g.fill(); }
      g.strokeStyle = '#2a1a10'; g.lineWidth = R * 0.05; for (const u of [-0.5, 0, 0.5]) { g.beginPath(); g.moveTo(x + u * R, y - Math.sqrt(1 - u * u) * R); g.lineTo(x + u * R, y + Math.sqrt(1 - u * u) * R); g.stroke(); }
      if (lit && word) text(g, word, x, y, R * 0.42, '#fff', { stroke: 'rgba(0,0,0,0.55)', lw: R * 0.08, max: R * 1.8 });
      g.restore();
    }
    function drum(g, x, y, R, hit) {
      const s = 1 + 0.12 * hit; g.save(); g.translate(x, y); g.scale(s, s);
      g.fillStyle = '#7a1f16'; g.fillRect(-R, -R * 0.2, R * 2, R * 1.1); g.beginPath(); g.ellipse(0, R * 0.9, R, R * 0.3, 0, 0, Math.PI); g.fill();
      g.strokeStyle = '#f3dfb3'; g.lineWidth = R * 0.05; g.beginPath(); for (let i = 0; i <= 8; i++) g.lineTo(-R + (i * 2 * R) / 8, i % 2 ? R * 0.8 : -R * 0.1); g.stroke();
      g.fillStyle = hit > 0.05 ? `rgb(${255},${240 - 30 * hit},${200 - 60 * hit})` : '#f1e2c2'; g.beginPath(); g.ellipse(0, -R * 0.2, R, R * 0.3, 0, 0, TAU); g.fill();
      g.strokeStyle = '#4a2a14'; g.lineWidth = R * 0.06; g.stroke();
      if (hit > 0.05) { g.strokeStyle = `rgba(255,220,120,${hit})`; g.lineWidth = R * 0.05; for (let i = 0; i < 8; i++) { const q = (i / 8) * TAU; g.beginPath(); g.moveTo(Math.cos(q) * R * 1.2, -R * 0.2 + Math.sin(q) * R * 0.5); g.lineTo(Math.cos(q) * R * (1.35 + hit * 0.3), -R * 0.2 + Math.sin(q) * R * (0.6 + hit * 0.2)); g.stroke(); } }
      g.restore();
    }
    function fire(g, x, y, R, t) {
      for (let i = 0; i < 3; i++) { g.fillStyle = ['#ff5a1f', '#ffae2b', '#fff2a8'][i]; const r = R * (1 - i * 0.3); g.beginPath(); g.moveTo(x - r, y); g.quadraticCurveTo(x - r * 0.6, y - r * (1.5 + 0.2 * Math.sin(t * 9 + i)), x + Math.sin(t * 7 + i) * r * 0.2, y - r * (2.2 + 0.3 * Math.sin(t * 11 + i))); g.quadraticCurveTo(x + r * 0.6, y - r * 1.5, x + r, y); g.closePath(); g.fill(); }
      g.fillStyle = '#4a2a14'; g.fillRect(x - R * 1.3, y - R * 0.1, R * 2.6, R * 0.25);
    }
    return { emoji, text, rr, scene, cowboy, lantern, drum, fire, tumbleweed, PAL };
  })();
  BOX.qdArt = ART;

  // ---------------------------------------------------------------- TV
  const TV = { s: null, el: null, cv: null, raf: 0, ctx: null, horse: new Map(), played: new Set(), resAt: 0, resKey: '', lastFlash: -1 };
  function tvLoop() {
    TV.raf = requestAnimationFrame(tvLoop);
    const cv = TV.cv; if (!cv || !cv.isConnected) { if (TV.el && !TV.el.isConnected) { cancelAnimationFrame(TV.raf); TV.raf = 0; } return; }
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    try { drawTv(g, W, H, TV.s); } catch (e) { console.error(e); }
  }
  function drawTv(g, W, H, s) {
    const t = performance.now() / 1000, c = s && s.c, kind = c ? c.kind : 'draw', K = KIND[kind] || KIND.draw;
    const hz = ART.scene(g, W, H, t, s && s.phase === 'intro' ? 'sunset' : K.pal, { signs: (s && s.n) || 0, weed: kind !== 'count' || !s || s.phase !== 'play', town: !(kind === 'shake' && s && s.phase === 'play') });
    if (!s) return;
    const now = L(), S = Math.min(W / 1600, H / 900);
    if (s.phase === 'intro') { ART.cowboy(g, W * 0.3, H * 0.9, H * 0.42, 1, { band: '#c0392b' }); ART.cowboy(g, W * 0.7, H * 0.9, H * 0.42, -1, { band: '#2f6b8a' }); return; }
    if (s.phase === 'result') return drawResultScene(g, W, H, s, t, hz, S);
    if (s.phase !== 'play' || !c) return;
    if (kind === 'draw') drawStandoff(g, W, H, c, now, t, S);
    else if (kind === 'flash') drawLantern(g, W, H, c, now, t, S);
    else if (kind === 'count') drawChickens(g, W, H, c, now, t, hz, S);
    else if (kind === 'shake') drawRace(g, W, H, c, now, t, hz, S);
    else if (kind === 'copy') drawDrum(g, W, H, c, now, t, S);
  }
  function once(key, fn) { if (TV.played.has(key)) return; TV.played.add(key); if (TV.played.size > 400) TV.played = new Set([key]); fn(); }
  function bigWord(g, W, H, word, k, col, S) {
    const sc = back(k); if (sc <= 0) return;
    g.save(); g.translate(W / 2, H * 0.36); g.scale(sc, sc);
    ART.text(g, word, 0, 0, 190 * S, col, { font: '"Abril Fatface", serif', stroke: '#3a1206', lw: 22 * S, glow: 'rgba(255,200,80,0.8)' });
    g.restore();
  }
  function drawStandoff(g, W, H, c, now, t, S) {
    const arm = toLocal(c.armAt), go = toLocal(c.goAt), shot = c.step === 'shot';
    const walk = clamp((now - (arm - 1800)) / 1800), gap = lerp(0.12, 0.3, easeOut(walk));
    const drawn = now >= go ? clamp((now - go) / 180) : 0;
    const steady = now >= arm && now < go;
    if (steady) { g.fillStyle = `rgba(20,5,0,${0.25 + 0.08 * Math.sin(now / 160)})`; g.fillRect(0, 0, W, H); }
    ART.cowboy(g, W * (0.5 - gap), H * 0.93, H * 0.5, 1, { arm: drawn, band: '#c0392b', flash: drawn > 0 && now - go < 260 ? 1 - (now - go) / 260 : 0 });
    ART.cowboy(g, W * (0.5 + gap), H * 0.93, H * 0.5, -1, { arm: drawn, band: '#2f6b8a', flash: drawn > 0 && now - go < 300 && now - go > 60 ? 1 - (now - go - 60) / 240 : 0 });
    if (now < arm) ART.text(g, c.mode === 'duel' ? `ROUND ${c.heat}${c.heat === c.heats ? ' · THE FINAL' : ''}` : `SHOT ${c.shot} OF ${c.shots}`, W / 2, H * 0.22, 64 * S, '#fff4d6', { font: '"Abril Fatface", serif', stroke: '#3a1206', lw: 10 * S });
    if (now < arm) ART.text(g, 'Ten paces…', W / 2, H * 0.33, 44 * S, '#ffe7a8', { font: '"Special Elite", monospace', stroke: '#2a1206', lw: 6 * S });
    if (steady) { const p = 1 + 0.04 * Math.sin(now / 120); g.save(); g.translate(W / 2, H * 0.3); g.scale(p, p); ART.text(g, 'STEADY…', 0, 0, 110 * S, '#ffd2a0', { font: '"Abril Fatface", serif', stroke: '#2a0a04', lw: 14 * S }); g.restore(); ART.text(g, 'don’t touch that pad', W / 2, H * 0.42, 34 * S, '#ffe7c8', { font: '"Special Elite", monospace', stroke: '#2a0a04', lw: 5 * S }); }
    if (now >= go) {
      once('go' + c.id + ':' + (c.heat || c.shot), () => sting('draw', 'revolver'));
      const f = 1 - clamp((now - go) / 300); if (f > 0) { g.fillStyle = `rgba(255,250,220,${f * 0.85})`; g.fillRect(0, 0, W, H); }
      if (!shot) bigWord(g, W, H, 'DRAW!', (now - go) / 260, '#ffd23f', S);
      else ART.text(g, 'BANG!', W / 2, H * 0.2, 100 * S, '#ffd23f', { font: '"Abril Fatface", serif', stroke: '#3a1206', lw: 14 * S });
    }
  }
  function drawLantern(g, W, H, c, now, t, S) {
    const ts = toServer(now), R = Math.min(W, H) * 0.2, x = W / 2, y = H * 0.5;
    let cur = null, idx = -1; for (let i = 0; i < c.flashes.length; i++) { const f = c.flashes[i]; if (f.at <= ts) idx = i; if (f.at <= ts && ts < f.at + f.dur) cur = f; }
    if (cur) { g.fillStyle = cur.col; g.globalAlpha = 0.22; g.fillRect(0, 0, W, H); g.globalAlpha = 1; once('fl' + c.id + ':' + idx, () => BOX.sfx('click')); }
    // the post
    g.fillStyle = '#3b2616'; g.fillRect(x + R * 1.6, y - R * 2.4, R * 0.16, H); g.fillRect(x - R * 0.1, y - R * 2.4, R * 1.86, R * 0.14);
    ART.lantern(g, x, y, R, cur ? cur.col : '#000', !!cur, cur ? cur.word : '', t);
    if (ts < c.armAt) { const n = Math.ceil((c.armAt - ts) / 800); ART.text(g, n > 0 ? String(n) : '', x, y, R * 0.9, '#ffe7a8', { font: '"Abril Fatface", serif', stroke: '#2a1206', lw: 10 * S }); ART.text(g, 'Eyes on the lantern…', W / 2, H * 0.12, 52 * S, '#ffe7a8', { font: '"Special Elite", monospace', stroke: '#1a0a04', lw: 6 * S }); }
    const greens = c.flashes.filter((f) => f.green), seen = greens.filter((f) => f.at <= ts).length;
    for (let i = 0; i < 3; i++) { g.fillStyle = i < seen ? '#22d35b' : 'rgba(255,255,255,0.18)'; g.beginPath(); g.arc(W / 2 + (i - 1) * 46 * S, H * 0.06, 15 * S, 0, TAU); g.fill(); g.strokeStyle = '#1a0a04'; g.lineWidth = 3; g.stroke(); }
  }
  function critterPos(cr, u, W, hz, H) {
    const k = clamp(u / cr.dur), x = cr.dir > 0 ? lerp(-0.06, 1.06, k) * W : lerp(1.06, -0.06, k) * W;
    const y = hz + H * 0.08 + cr.y * (H * 0.92 - hz - H * 0.08), hop = Math.abs(Math.sin(k * Math.PI * 10 * cr.hop)) * H * 0.025;
    return { x, y: y - hop, size: (0.06 + 0.06 * cr.y) * H, k };
  }
  function drawChickens(g, W, H, c, now, t, hz, S) {
    const ts = toServer(now), u = ts - c.runAt;
    const vis = c.crit.filter((cr) => u >= cr.at && u <= cr.at + cr.dur).sort((a, b) => a.y - b.y);
    for (const cr of vis) {
      const p = critterPos(cr, u - cr.at, W, hz, H);
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(p.x, p.y + p.size * 0.42, p.size * 0.36, p.size * 0.1, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,230,190,0.35)'; for (let i = 1; i < 4; i++) { g.beginPath(); g.arc(p.x - cr.dir * p.size * 0.3 * i, p.y + p.size * 0.38, p.size * 0.07 * (4 - i), 0, TAU); g.fill(); }
      ART.emoji(g, cr.e, p.x, p.y, p.size, cr.dir > 0);
    }
    if (u < 0) { ART.text(g, 'Count the chickens…', W / 2, H * 0.2, 64 * S, '#5a2a10', { font: '"Abril Fatface", serif', stroke: '#fff4d6', lw: 8 * S }); ART.emoji(g, '🐔', W / 2, H * 0.4, 130 * S); }
    if (c.step === 'lock') { ART.text(g, 'HOW MANY 🐔?', W / 2, H * 0.24, 110 * S, '#fff4d6', { font: '"Abril Fatface", serif', stroke: '#5a2a10', lw: 14 * S }); ART.emoji(g, '🐔', W * 0.5 + Math.sin(t * 2) * W * 0.02, H * 0.62, 120 * S, Math.sin(t) > 0); }
  }
  function drawRace(g, W, H, c, now, t, hz, S) {
    const ts = toServer(now), started = ts >= c.goAt;
    const all = c.racers.slice(), show = all.length > 10 ? all.slice().sort((a, b) => (b.fin != null) - (a.fin != null) || (a.fin || 0) - (b.fin || 0) || b.n - a.n).slice(0, 10) : all;
    const top = H * 0.2, bot = H * 0.97, lh = (bot - top) / Math.max(4, show.length), x0 = W * 0.17, x1 = W * 0.9;
    // finish line
    for (let y = top; y < bot; y += 14) for (let i = 0; i < 2; i++) { g.fillStyle = ((y - top) / 14 + i) % 2 < 1 ? '#fff' : '#111'; g.fillRect(x1 + i * 10, y, 10, 14); }
    const fins = all.filter((r) => r.fin != null).sort((a, b) => a.fin - b.fin).map((r) => r.id);
    show.forEach((r, i) => {
      const y = top + lh * (i + 0.5);
      g.fillStyle = i % 2 ? 'rgba(120,70,30,0.25)' : 'rgba(255,230,190,0.12)'; g.fillRect(0, y - lh / 2, W, lh);
      g.strokeStyle = 'rgba(90,50,20,0.6)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, y + lh / 2 - 2); g.lineTo(W, y + lh / 2 - 2); g.stroke();
      const want = clamp(r.n / c.target), cur = TV.horse.has(r.id) ? TV.horse.get(r.id) : 0, k = cur + (want - cur) * 0.12; TV.horse.set(r.id, k);
      const x = lerp(x0, x1 - lh * 0.4, k), bob = started && r.fin == null && r.n > 0 ? Math.abs(Math.sin(t * 14 + i)) * lh * 0.08 : 0, sz = Math.min(lh * 0.82, 90 * S);
      ART.emoji(g, '🐎', x, y - bob, sz, true);
      ART.emoji(g, r.avatar || '🤠', x + sz * 0.08, y - bob - sz * 0.42, sz * 0.5);
      ART.text(g, r.name, 12 * S, y, Math.min(30 * S, lh * 0.38), '#fff4d6', { align: 'left', stroke: '#2a1206', lw: 5 * S, max: x0 - 30 * S });
      const place = fins.indexOf(r.id); if (place >= 0) ART.text(g, medal(place), x1 + lh * 0.5, y, lh * 0.5, '#fff');
    });
    if (!started) { const n = Math.ceil((c.goAt - ts) / 1000); once('cd' + c.id + n, () => n <= 3 && BOX.sfx('tick')); g.fillStyle = 'rgba(30,10,0,0.35)'; g.fillRect(0, 0, W, H); ART.text(g, n <= 3 ? String(n) : 'SADDLE UP!', W / 2, H * 0.45, (n <= 3 ? 220 : 110) * S, '#ffd23f', { font: '"Abril Fatface", serif', stroke: '#3a1206', lw: 16 * S }); }
    else if (ts - c.goAt < 700) { once('gogo' + c.id, () => sting('gallop', 'start')); bigWord(g, W, H, 'GO!', (ts - c.goAt) / 250, '#ffd23f', S); }
    ART.text(g, '📳 SHAKE YOUR PHONE!', W / 2, H * 0.1, 56 * S, '#fff4d6', { font: '"Abril Fatface", serif', stroke: '#3a1206', lw: 9 * S });
  }
  function drawDrum(g, W, H, c, now, t, S) {
    const ts = toServer(now);
    let hit = 0, done = 0;
    c.beats.forEach((b, i) => { if (ts >= b) { done = i + 1; hit = Math.max(hit, 1 - clamp((ts - b) / 260)); once('bt' + c.id + ':' + c.k + ':' + i, () => sting('beat', 'knock')); } });
    ART.fire(g, W * 0.18, H * 0.9, H * 0.07, t); ART.fire(g, W * 0.82, H * 0.9, H * 0.07, t + 3);
    ART.drum(g, W / 2, H * 0.62, H * 0.2, hit);
    const n = c.beats.length, listen = c.step === 'listen';
    for (let i = 0; i < n; i++) { const x = W / 2 + (i - (n - 1) / 2) * 56 * S; g.fillStyle = listen ? (i < done ? '#ffd23f' : 'rgba(255,255,255,0.2)') : '#ffd23f'; g.beginPath(); g.arc(x, H * 0.95, 16 * S, 0, TAU); g.fill(); }
    const label = c.step === 'listen' ? (ts < c.demoAt ? 'Listen closely…' : '👂 LISTEN') : c.step === 'repeat' ? '🥁 YOUR TURN!' : 'Next rhythm…';
    ART.text(g, label, W / 2, H * 0.16, 90 * S, c.step === 'repeat' ? '#ffd23f' : '#fff4d6', { font: '"Abril Fatface", serif', stroke: '#1a0a04', lw: 12 * S });
    ART.text(g, `Rhythm ${c.k + 1} of ${c.pats} · ${n} beats`, W / 2, H * 0.27, 36 * S, '#ffe7a8', { font: '"Special Elite", monospace', stroke: '#1a0a04', lw: 5 * S });
  }
  function drawResultScene(g, W, H, s, t, hz, S) {
    const c = s.c, res = c && c.res; if (!res) return;
    const u = (L() - TV.resAt) / 1000;
    if (c.kind === 'count' && res.answer != null) {
      const N = res.answer, per = Math.min(64 * S, (W * 0.92) / Math.max(1, N));
      for (let i = 0; i < N; i++) {
        const k = clamp((u - 0.2 - i * 0.12) / 0.25); if (k <= 0) continue;
        const x = W / 2 + (i - (N - 1) / 2) * per, y = H * 0.09;
        ART.emoji(g, '🐔', x, y - (1 - back(k)) * 40, per * 0.85 * back(k));
        if (k >= 1 && i === Math.min(N - 1, Math.floor((u - 0.2) / 0.12))) once('cl' + c.id + i, () => BOX.sfx('pop'));
      }
    } else {
      ART.cowboy(g, W * 0.12, H * 0.95, H * 0.36, 1, { arm: 0.15 });
      ART.cowboy(g, W * 0.88, H * 0.95, H * 0.36, -1, { arm: 0.15, band: '#2f6b8a' });
    }
  }

  // TV overlay HTML
  const lineupDots = (s) => `<div class="qd-dots">${(s.lineup || []).map((k, i) => `<span class="${i + 1 < s.n ? 'done' : i + 1 === s.n ? 'now' : ''} ${i === s.lineup.length - 1 && s.lineup.length > 1 ? 'fin' : ''}" title="${esc(KIND[k].name)}">${KIND[k].icon}</span>`).join('')}</div>`;
  function overlayHtml(s) {
    const c = s.c, K = c ? KIND[c.kind] : KIND.draw;
    if (s.phase === 'intro' && c) {
      return `<div class="qd-poster" id="qd-po-${c.id}"><div class="qd-po-tag">${c.mult > 1 ? '🔥 FINAL SHOWDOWN · DOUBLE POINTS 🔥' : `CHALLENGE ${s.n} OF ${s.of}`}</div>
        <div class="qd-po-icon">${K.icon}</div><h1>${esc(K.name)}</h1><p>${esc(K.rule)}</p><div class="qd-po-foot">📱 ${esc(K.phone)}</div></div>`;
    }
    if (s.phase === 'result' && c && c.res) {
      const r = c.res, rows = r.rows.slice(0, 10);
      return `<div class="qd-res" id="qd-res-${c.id}"><div class="qd-res-h">${K.icon} ${esc(K.name)} ${c.mult > 1 ? '<span class="qd-x2">×2</span>' : ''}</div>
        ${r.top ? `<div class="qd-res-top">🏆 <b>${av(r.top)} ${esc(r.top.name)}</b> ${c.kind === 'count' ? `· there were <b>${r.answer}</b> 🐔` : c.kind === 'draw' ? 'is the fastest gun' : 'takes it'}</div>` : ''}
        <div class="qd-res-rows">${rows.map((x, i) => `<div class="qd-rrow ${x.rank === 0 ? 'win' : ''}" style="animation-delay:${(0.15 + i * 0.08).toFixed(2)}s;--c:${esc(x.color)}"><span class="rk">${medal(x.rank)}</span><span class="nm">${av(x)} ${esc(x.name)}</span><span class="lb">${esc(x.label)}</span><span class="tags">${x.streak >= 2 ? `<i class="st">🔥${x.streak}</i>` : ''}${x.fs ? `<i class="fs">💥×${x.fs}</i>` : ''}</span><b class="gn ${x.gain < 0 ? 'neg' : ''}">${x.gain >= 0 ? '+' : ''}${x.gain}</b></div>`).join('')}${r.rows.length > 10 ? `<div class="qd-more">+${r.rows.length - 10} more</div>` : ''}</div>
        ${r.jibe ? `<div class="qd-jibe">💥 ${esc(r.jibe)}</div>` : ''}</div>`;
    }
    if (s.phase !== 'play' || !c) return '';
    if (c.kind === 'draw') {
      if (c.mode === 'duel') {
        const res = (x) => (x.r ? (x.r.false ? '<em class="bad">💥 FALSE START</em>' : `<em>${secs(x.r.ms)}</em>`) : c.step === 'shot' ? '<em class="none">no draw</em>' : x.tapped ? '<em class="in">🔫</em>' : '');
        const card = (pr, i) => `<div class="qd-duel ${c.step === 'shot' ? 'done' : ''}" style="animation-delay:${i * 0.08}s"><div class="qd-gun ${pr.win === pr.a.id ? 'win' : pr.win ? 'lose' : ''}" style="--c:${esc(pr.a.color)}"><span class="a">${av(pr.a)}</span><b>${esc(pr.a.name)}</b>${res(pr.a)}</div><div class="qd-vs">${pr.coin ? '🪙' : 'VS'}</div><div class="qd-gun ${pr.win === pr.b.id ? 'win' : pr.win ? 'lose' : ''}" style="--c:${esc(pr.b.color)}"><span class="a">${av(pr.b)}</span><b>${esc(pr.b.name)}</b>${res(pr.b)}</div></div>`;
        return `<div class="qd-duels n${c.pairs.length}">${c.pairs.map(card).join('')}${c.bye ? `<div class="qd-bye">🍀 ${av(c.bye)} ${esc(c.bye.name)} gets a bye</div>` : ''}</div>`;
      }
      const sh = c.shotRes;
      return `<div class="qd-ffa"><div class="qd-chip">🔫 Everyone draws at once · ${c.tapped}/${c.count} drew</div>${sh ? `<div class="qd-shot">${sh.map((x, i) => `<span class="${x.r && x.r.false ? 'bad' : ''}" style="animation-delay:${i * 0.05}s">${i === 0 && x.r && x.r.ms ? '⚡' : ''}${av(x)} ${esc(x.name)} <b>${x.r ? (x.r.false ? '💥' : secs(x.r.ms)) : '—'}</b></span>`).join('')}${c.more ? `<span>+${c.more}</span>` : ''}</div>` : ''}</div>`;
    }
    if (c.kind === 'flash') return `<div class="qd-band">🏮 Tap on <b class="g">GREEN</b> only! <span>✅ ${c.hits} · 💥 ${c.falses}</span></div>`;
    if (c.kind === 'count') return c.step === 'lock' ? `<div class="qd-band">🔒 Lock in your count! <span>${c.locked}/${c.of} locked</span></div>` : '<div class="qd-band">🐔 Count only the <b>chickens</b>! <span>📱 tap +1 for each</span></div>';
    if (c.kind === 'copy') return c.step === 'repeat' ? `<div class="qd-band">🥁 Tap it back on your phone! <span>${c.done}/${c.of} sent</span></div>` : '';
    return '';
  }
  function sideHtml(s) {
    return `<div class="qd-side-h">🤠 THE POSSE</div>${s.standings.map((r, i) => `<div class="qd-srow" style="--c:${esc(r.color)}"><span class="n">${i + 1}</span><span class="nm">${av(r)} ${esc(r.name)}</span><b>${r.points}</b></div>`).join('')}${s.players > s.standings.length ? `<div class="qd-more">+${s.players - s.standings.length} more</div>` : ''}`;
  }
  function tvOver(el, s) {
    const f = s.final || { standings: [], awards: [] }, st = f.standings, w = st[0];
    const pod = [st[1], st[0], st[2]].map((r, i) => (r ? `<div class="qd-pod p${[2, 1, 3][i]}" style="--c:${esc(r.color)}"><div class="a">${av(r)}</div><b>${esc(r.name)}</b><span>${r.points} pts</span><div class="blk">${[2, 1, 3][i]}</div></div>` : '<div></div>')).join('');
    BOX.morph(el, `<div class="qd-over"><div class="qd-over-h"><small>THE FASTEST GUN IN THE WEST</small><h1>${w ? `${av(w)} ${esc(w.name)}` : 'Nobody!'}</h1></div>
      <div class="qd-over-main"><div class="qd-podium">${pod}</div>
      <div class="qd-awards">${f.awards.map((a, i) => `<div class="qd-award" style="animation-delay:${0.5 + i * 0.25}s"><div class="ic">${a.icon}</div><div class="tt">${esc(a.title)}</div><div class="nm">${av(a)} ${esc(a.name)}</div><div class="tx">${esc(a.text)}</div></div>`).join('')}</div>
      <div class="qd-final">${st.slice(0, 12).map((r, i) => `<div class="qd-srow" style="--c:${esc(r.color)}"><span class="n">${i + 1}</span><span class="nm">${av(r)} ${esc(r.name)}</span><b>${r.points}</b></div>`).join('')}</div></div></div>`);
  }
  function tv(el, s, ctx) {
    if (!s) return;
    TV.s = s; TV.ctx = ctx; TV.el = el; seedClock(s.now);
    if (s.phase !== 'over' && ctx && ctx.host) maybeSync(() => ctx.host('qdPing'));
    if (s.phase === 'over') { TV.cv = null; return tvOver(el, s); }
    const c = s.c, rk = s.phase === 'result' && c ? 'r' + c.id : '';
    if (rk && TV.resKey !== rk) { TV.resKey = rk; TV.resAt = L(); }
    if (c && c.kind === 'shake' && s.phase === 'play' && TV.horseId !== c.id) { TV.horseId = c.id; TV.horse = new Map(); }
    const K = c ? KIND[c.kind] : null;
    BOX.morph(el, `<div class="qd-tv"><header class="qd-top"><div class="qd-logo">QUICK<b>DRAW</b></div>${lineupDots(s)}<div class="qd-now">${K && s.phase !== 'intro' ? `${K.icon} ${esc(K.name)}` : ''}${c && c.mult > 1 ? ' <span class="qd-x2">×2</span>' : ''}</div></header>
      <div class="qd-main"><div class="qd-stagewrap"><div class="qd-stage" id="qd-stage" data-keep></div><div class="qd-ov">${overlayHtml(s)}</div></div><aside class="qd-side">${sideHtml(s)}</aside></div></div>`);
    const st = el.querySelector('#qd-stage');
    if (st && !st.querySelector('canvas')) st.innerHTML = '<canvas class="qd-cv"></canvas>';
    TV.cv = st ? st.querySelector('canvas') : null;
    if (!TV.raf) TV.raf = requestAnimationFrame(tvLoop);
  }

  // ---------------------------------------------------------------- lobby (a saloon wall)
  let LOBBY = null;
  const SET_ICON = { rounds: '🎯', mix: '🃏', pace: '🌵', showIntro: '🎬' };
  function lobbyBg(cv) {
    const step = () => {
      if (!cv.isConnected) return; requestAnimationFrame(step);
      const dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      ART.scene(g, W, H, performance.now() / 1000, 'sunset', { horizon: 0.62 });
    };
    requestAnimationFrame(step);
  }
  function lobbyTv(el, Lb) {
    if (!el.querySelector('.qdl')) {
      el.innerHTML = `<div class="qdl"><canvas class="qdl-bg"></canvas>
        <div class="qdl-wall">
          <div class="qdl-sign"><span class="qdl-nail l"></span><span class="qdl-nail r"></span><h1>QUICK <b>DRAW</b></h1><p>Fastest thumb in the West</p></div>
          <div class="qdl-body">
            <div class="qdl-wanted"><div class="qdl-w-h">WANTED</div><div class="qdl-w-s">GUNSLINGERS · SCAN TO JOIN</div><img id="qr" alt="QR code to join"><div class="qdl-w-l">Room code</div><div class="qdl-code" id="code"></div><div class="qdl-url" id="qdl-url"></div></div>
            <div class="qdl-board"><div class="qdl-b-h">📜 THE RULES OF TOWN</div><div class="qdl-settings" id="settings"></div>
              <div class="qdl-how"><span>🔫 DRAW! duels</span><span>🏮 Green lantern</span><span>🐔 Chicken count</span><span>🐎 Shake stampede</span><span>🥁 Copycat drum</span></div></div>
            <div class="qdl-go"><button class="qdl-start" id="start"><span>DRAW!</span><small>start</small></button><div class="qdl-err" id="lobby-err"></div></div>
          </div>
          <div class="qdl-posse-h">🤠 THE POSSE <b id="qdl-n"></b></div>
          <div class="qdl-roster" id="roster"></div>
          <div id="qdl-lineup"></div>
          <div class="qdl-links"><button class="link" id="add-bots">🤖 + 5 test bots</button><button class="link" id="qdl-rm">remove bots</button><button class="link" id="pick">🎮 Another game</button></div>
        </div></div>`;
      lobbyBg(el.querySelector('.qdl-bg'));
      el.querySelector('#start').onclick = async () => { const r = await LOBBY.start(); el.querySelector('#lobby-err').textContent = r && r.ok ? '' : (r && r.error) || ''; };
      el.querySelector('#add-bots').onclick = () => LOBBY.bots(5);
      el.querySelector('#qdl-rm').onclick = () => LOBBY.removeBots();
      el.querySelector('#pick').onclick = () => LOBBY.pick();
    }
    LOBBY = Lb;
    el.querySelector('#code').textContent = Lb.code;
    el.querySelector('#qdl-url').textContent = (Lb.joinUrl || '').replace(/^https?:\/\//, '').replace(/\?.*$/, '');
    const q = el.querySelector('#qr'); if (q.dataset.u !== Lb.qr) { q.src = Lb.qr; q.dataset.u = Lb.qr; }
    const set = el.querySelector('#settings'), sig = JSON.stringify([Lb.settings, Lb.fields.map((f) => f.key)]);
    if (set.dataset.sig !== sig && !(document.activeElement && document.activeElement.tagName === 'SELECT' && set.contains(document.activeElement))) {
      set.dataset.sig = sig;
      set.innerHTML = Lb.fields.map((f) => `<div class="qdl-row"><div class="qdl-lab">${SET_ICON[f.key] || '⚙️'} ${esc(f.label)}</div><div class="qdl-chips">${f.options.map((o) => `<button class="qdl-chip ${String(Lb.settings[f.key]) === String(o.value) ? 'on' : ''}" data-k="${esc(f.key)}" data-v="${esc(String(o.value))}">${esc(o.label)}</button>`).join('')}</div>
        <select class="qdl-hide" data-set="${esc(f.key)}" aria-label="${esc(f.label)}">${f.options.map((o) => `<option value="${esc(String(o.value))}" ${String(Lb.settings[f.key]) === String(o.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></div>`).join('');
      for (const s of set.querySelectorAll('[data-set]')) s.onchange = () => LOBBY.set(s.dataset.set, s.value);
      for (const b of set.querySelectorAll('[data-k]')) b.onclick = () => { const s = set.querySelector(`[data-set="${b.dataset.k}"]`); if (s) { s.value = b.dataset.v; s.onchange(); } for (const x of set.querySelectorAll(`[data-k="${b.dataset.k}"]`)) x.classList.toggle('on', x === b); BOX.sfx('click'); };
    }
    el.querySelector('#qdl-n').textContent = Lb.players.length ? `(${Lb.players.length})` : '';
    BOX.morph(el.querySelector('#roster'), Lb.players.map((p, i) => `<span class="chip ${p.online ? '' : 'off'} ${p.name === Lb.vip ? 'vip' : ''}" style="--c:${esc(p.color)};--r:${((i * 37) % 7) - 3}deg"><span class="av">${esc(p.avatar || '🙂')}</span>${esc(p.name)}${p.name === Lb.vip ? ' 👑' : ''}</span>`).join('') || '<span class="qdl-empty">The saloon is empty… scan the poster to ride in! 🌵</span>');
    const lu = el.querySelector('#qdl-lineup'); if (lu.dataset.h !== (Lb.lineupHtml || '')) { lu.innerHTML = Lb.lineupHtml || ''; lu.dataset.h = Lb.lineupHtml || ''; }
    el.querySelector('#start').disabled = Lb.players.length < (Lb.min || 1);
  }

  // ---------------------------------------------------------------- phone
  const PH = { v: null, ctx: null, raf: 0, key: '', wrap: null, felt: {}, motion: false, motionAsked: false, motionBound: false, cache: {} };
  let PL = {}; // this challenge's local state (reset per challenge / heat / rhythm)
  const haptic = (k) => { try { if (PH.ctx && PH.ctx.haptic) PH.ctx.haptic(k); else if (PH.ctx && PH.ctx.vibrate) PH.ctx.vibrate(k === 'tap' ? 10 : 40); } catch { /* none */ } };
  const feel = (chan, key, kind) => { if (PH.felt[chan] === key) return; PH.felt[chan] = key; haptic(kind); };
  const needsPermission = () => typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function';
  function bindMotion() {
    if (PH.motionBound || typeof window === 'undefined') return; PH.motionBound = true;
    let last = 0, lastMag = 0;
    window.addEventListener('devicemotion', (e) => {
      const V = PH.v && PH.v.c; if (!V || V.kind !== 'shake' || PH.v.phase !== 'play') return;
      const a = e.acceleration && e.acceleration.x != null ? e.acceleration : null, ag = e.accelerationIncludingGravity;
      let mag = 0;
      if (a) mag = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
      else if (ag) { const m = Math.hypot(ag.x || 0, ag.y || 0, ag.z || 0); mag = Math.abs(m - lastMag) * 1.6; lastMag = m; }
      PH.motion = true;
      const tl = L();
      if (mag > 13 && tl - last > 110) { last = tl; shakeOne(tl); }
    });
  }
  function shakeOne(tl) {
    const V = PH.v && PH.v.c; if (!V || V.kind !== 'shake' || PL.fin) return;
    if (tl < toLocal(V.goAt)) return;
    PL.n = Math.min(V.target, (PL.n || 0) + 1);
    if (PL.n >= V.target && !PL.finAt) { PL.finAt = tl; haptic('success'); }
    else if (PL.n % 4 === 0) haptic('tap');
  }
  function sendShake(force) {
    const V = PH.v && PH.v.c; if (!V || PL.sending) return;
    const tl = L(); if (!force && (PL.n || 0) <= (PL.sent || 0)) return; if (!force && tl - (PL.lastSend || 0) < 160) return;
    PL.lastSend = tl; PL.sending = true; const n = PL.n || 0;
    PH.ctx.act({ op: 'shake', c: V.id, n, t: toServer(PL.finAt || tl) }).then((r) => { PL.sending = false; if (r && r.ok) { PL.sent = Math.max(PL.sent || 0, n); if (r.fin != null) { PL.fin = r.fin; BOX.sfx('win'); } } });
  }
  function sendRhythm() {
    const V = PH.v && PH.v.c; if (!V || PL.sent || !PL.taps || !PL.taps.length) return;
    PL.sent = true; const base = PL.taps[0];
    PH.ctx.act({ op: 'rhythm', c: V.id, k: V.k, taps: PL.taps.map((x) => Math.round(x - base)) }).then((r) => { if (r && r.ok) { PL.acc = r.acc; haptic(r.acc >= 80 ? 'success' : 'select'); } });
  }
  function sendCount(lock) {
    const V = PH.v && PH.v.c; if (!V) return;
    clearTimeout(PL.ct);
    if (lock) return PH.ctx.act({ op: 'lock', c: V.id, n: PL.count }).then((r) => { if (r && r.ok) { PL.locked = true; haptic('success'); BOX.sfx('chime'); paintPad(true); } });
    PL.ct = setTimeout(() => PH.ctx.act({ op: 'count', c: V.id, n: PL.count }), 250);
  }
  // A tap on the big pad (pointerdown: the fastest event, stamped right away).
  function onPad(e) {
    if (e.target.closest('button')) return;
    e.preventDefault();
    const tl = L(), v = PH.v, V = v && v.c; if (!V || v.phase !== 'play') return;
    if (V.kind === 'draw') {
      if (!V.inHeat || PL.tapped || V.step !== 'standoff' || tl < toLocal(V.armAt) || tl > toLocal(V.endAt)) return;
      PL.tapped = true; const early = tl < toLocal(V.goAt);
      if (early) { PL.false = true; haptic('error'); BOX.sfx('boo'); } else { PL.ms = Math.max(100, Math.round(tl - toLocal(V.goAt))); haptic('success'); BOX.sfx('shot'); }
      PH.ctx.act({ op: 'tap', c: V.id, t: toServer(tl) }).then((r) => { if (r && r.ok) { if (r.false) { PL.false = true; PL.ms = null; } else if (r.ms != null) PL.ms = r.ms; } else if (r && !r.again) { PL.tapped = false; PL.ms = null; PL.false = false; } paintPad(true); });
    } else if (V.kind === 'flash') {
      if (tl - (PL.last || 0) < 110) return; PL.last = tl; haptic('tap');
      PH.ctx.act({ op: 'tap', c: V.id, t: toServer(tl) }).then((r) => {
        if (!r || !r.ok) return;
        if (r.ms != null) { PL.fb = { t: `✅ ${secs(r.ms)}`, cls: 'good', until: L() + 1100 }; haptic('success'); }
        else if (r.false) { PL.fb = { t: '💥 DECOY!', cls: 'bad', until: L() + 1100 }; haptic('error'); }
        paintPad(true);
      });
    } else if (V.kind === 'count') {
      if (PL.locked) return;
      PL.count = Math.min(99, (PL.count || 0) + 1); PL.bump = tl; haptic('tap'); sendCount(false);
    } else if (V.kind === 'shake') {
      shakeOne(tl);
    } else if (V.kind === 'copy') {
      if (V.step !== 'repeat' || PL.sent) return;
      PL.taps = PL.taps || []; PL.taps.push(tl); PL.bump = tl; haptic('tap'); BOX.sfx('knock');
      if (PL.taps.length >= V.beats.length) sendRhythm();
    }
    paintPad(true);
  }
  // The pad's look and words for this instant (pure): { cls, big, sub, extra }.
  function padLook(v, now) {
    const V = v.c;
    if (V.kind === 'draw') {
      if (!V.inHeat) return { cls: 'watch', big: V.out ? '👀' : V.bye ? '🍀' : '👀', sub: V.out ? 'You’re out of this one. Watch the duels!' : V.bye ? 'A bye! You ride straight through.' : 'Watch the TV…' };
      if (V.step === 'shot' && V.won != null) {
        const mine = PL.false ? '💥 False start' : PL.ms != null ? secs(PL.ms) : 'no draw', opp = V.oppR ? (V.oppR.false ? '💥 false start' : secs(V.oppR.ms)) : 'no draw';
        return { cls: V.won ? 'won' : 'lost', big: V.won ? 'YOU WIN!' : 'YOU LOSE', sub: `${mine} vs ${opp}${V.coin ? ' · coin flip 🪙' : ''}` };
      }
      if (PL.false) return { cls: 'false', big: '💥 TOO EARLY!', sub: 'False start! −50' };
      if (PL.ms != null) return { cls: 'done', big: secs(PL.ms), sub: V.opp ? `vs ${V.opp.name}…` : 'Nice shootin’!' };
      const arm = toLocal(V.armAt), go = toLocal(V.goAt);
      const vs = V.mode === 'duel' && V.opp ? `vs ${V.opp.avatar || ''} ${V.opp.name}` : V.mode === 'ffa' ? `Shot ${V.shot} of ${V.shots}` : '';
      if (now < arm) return { cls: 'walk', big: 'TEN PACES…', sub: vs };
      if (now < go) return { cls: 'steady', big: 'STEADY…', sub: 'Don’t tap yet!' };
      if (V.step === 'shot' || now > toLocal(V.endAt)) return { cls: 'lost', big: 'TOO SLOW', sub: 'Never drew!' };
      return { cls: 'go', big: 'DRAW!', sub: 'TAP!' };
    }
    if (V.kind === 'flash') {
      const fb = PL.fb && now < PL.fb.until ? PL.fb : null;
      return { cls: fb ? 'flash ' + fb.cls : 'flash', big: fb ? fb.t : '👀 WATCH THE TV', sub: 'Tap ONLY on 🟢 GREEN', extra: `✅ ${V.hits}/3 · 💥 ${V.falses}` };
    }
    if (V.kind === 'count') {
      const pop = PL.bump && now - PL.bump < 140 ? ' pop' : '';
      if (PL.locked || V.locked) return { cls: 'count locked', big: `${PL.count || 0}`, sub: '🔒 Locked in! Watch the TV.' };
      if (V.step === 'lock') return { cls: 'count lock' + pop, big: `${PL.count || 0}`, sub: 'How many 🐔? Fix it, then lock in!' };
      return { cls: 'count' + pop, big: `${PL.count || 0}`, sub: now < toLocal(V.runAt) ? 'Get ready to count 🐔…' : 'TAP +1 for every 🐔' };
    }
    if (V.kind === 'shake') {
      const go = toLocal(V.goAt), k = Math.round(((PL.n || 0) / V.target) * 100);
      if (PL.fin != null || V.fin != null) return { cls: 'won', big: '🏁 FINISHED!', sub: `${secs(PL.fin != null ? PL.fin : V.fin)}${V.place ? ` · ${ord(V.place)} place` : ''}`, k: 100 };
      if (now < go) { const n = Math.ceil((go - now) / 1000); return { cls: 'walk', big: n <= 3 ? String(n) : 'SADDLE UP', sub: 'Get a grip on your phone!', k: 0 }; }
      return { cls: 'shake' + (PL.bump && now - PL.bump < 100 ? ' pop' : ''), big: '📳 SHAKE!', sub: PH.motion ? 'Shake shake shake!' : 'Shake it, or mash the pad!', k };
    }
    if (V.kind === 'copy') {
      if (V.step === 'listen') {
        let hit = 0; for (const b of V.beats) { const d = now - toLocal(b); if (d >= 0 && d < 180) hit = 1; }
        return { cls: 'listen' + (hit ? ' beat' : ''), big: '👂 LISTEN', sub: `${V.beats.length} beats · rhythm ${V.k + 1} of ${V.pats}` };
      }
      if (V.step === 'repeat') {
        if (PL.sent || V.sent) return { cls: 'done', big: PL.acc != null || V.acc != null ? `${PL.acc != null ? PL.acc : V.acc}%` : '✓ Sent', sub: 'in rhythm' };
        return { cls: 'repeat' + (PL.bump && now - PL.bump < 120 ? ' pop' : ''), big: '🥁 YOUR TURN', sub: `Tap the ${V.beats.length} beats back` };
      }
      return { cls: 'listen', big: 'NEXT…', sub: 'Another rhythm coming' };
    }
    return { cls: '', big: '', sub: '' };
  }
  function paintPad(force) {
    const wrap = PH.wrap, v = PH.v; if (!wrap || !wrap.isConnected || !v || !v.c || v.phase !== 'play') return;
    const now = L(), V = v.c, lk = padLook(v, now);
    const set = (id, prop, val) => { const el = wrap.querySelector(id); if (el && el[prop] !== val) el[prop] = val; };
    set('#qd-pad', 'className', 'qd-pad ' + lk.cls);
    set('#qd-big', 'textContent', lk.big); set('#qd-sub', 'textContent', lk.sub); set('#qd-extra', 'textContent', lk.extra || '');
    if (V.kind === 'shake') { const f = wrap.querySelector('#qd-fill'); if (f) f.style.width = (lk.k != null ? lk.k : 0) + '%'; const pb = wrap.querySelector('#qd-perm'); if (pb) pb.hidden = !needsPermission() || PH.motion || PH.motionAsked; }
    if (V.kind === 'count') { const lb = wrap.querySelector('#qd-lock'); if (lb) { lb.hidden = V.step !== 'lock' || PL.locked || V.locked; lb.textContent = `🔒 Lock in ${PL.count || 0}`; } const mn = wrap.querySelector('.qd-cbtns'); if (mn) mn.hidden = PL.locked || V.locked; }
    if (V.kind === 'copy') {
      const d = wrap.querySelector('#qd-cdots'); if (d) {
        const n = V.beats.length, k = V.step === 'listen' ? V.beats.filter((b) => now >= toLocal(b)).length : (PL.taps || []).length;
        const h = Array.from({ length: n }, (_, i) => `<i class="${i < k ? 'on' : ''}"></i>`).join(''); if (d.__h !== h) { d.__h = h; d.innerHTML = h; }
      }
    }
    // the moment of truth: a buzz when the signal fires
    if (V.kind === 'draw' && V.inHeat && !PL.tapped && now >= toLocal(V.goAt) && V.step === 'standoff') feel('go', V.id + ':' + (V.heat || V.shot), 'buzz');
    if (V.kind === 'shake' && now >= toLocal(V.goAt)) feel('go', 's' + V.id, 'buzz');
    if (V.kind === 'copy' && V.step === 'repeat' && !PL.sent && PL.taps && PL.taps.length >= 2 && now - PL.taps[PL.taps.length - 1] > 1800) sendRhythm();
    if (V.kind === 'copy' && V.step === 'repeat' && !PL.sent && PL.taps && PL.taps.length && now > toLocal(V.repeatEnd) - 400) sendRhythm();
    if (V.kind === 'shake') sendShake(PL.finAt && PL.fin == null && !PL.sending && now - (PL.lastSend || 0) > 400);
  }
  function phoneLoop() { PH.raf = requestAnimationFrame(phoneLoop); if (PH.wrap && PH.wrap.isConnected) paintPad(); }
  function buildPad(wrap, V) {
    const extra = V.kind === 'count' ? '<div class="qd-cbtns"><button class="qd-small" id="qd-minus">−1</button><button class="qd-lock" id="qd-lock" hidden>🔒 Lock in</button><button class="qd-small" id="qd-plus">+1</button></div>'
      : V.kind === 'shake' ? '<div class="qd-bar"><i id="qd-fill"></i><span>🏁</span></div><button class="qd-perm" id="qd-perm" hidden>📳 Allow shaking</button>'
        : V.kind === 'copy' ? '<div class="qd-cdots" id="qd-cdots"></div>' : '';
    wrap.innerHTML = `<div class="qd-pad" id="qd-pad"><div class="qd-big" id="qd-big"></div><div class="qd-sub" id="qd-sub"></div><div class="qd-extra" id="qd-extra"></div></div>${extra}`;
    const pad = wrap.querySelector('#qd-pad');
    pad.addEventListener('pointerdown', onPad, { passive: false });
    pad.addEventListener('contextmenu', (e) => e.preventDefault());
    const b = (id, fn) => { const el = wrap.querySelector(id); if (el) el.onclick = fn; };
    b('#qd-minus', () => { if (PL.locked) return; PL.count = Math.max(0, (PL.count || 0) - 1); haptic('select'); sendCount(false); paintPad(true); });
    b('#qd-plus', () => { if (PL.locked) return; PL.count = Math.min(99, (PL.count || 0) + 1); haptic('tap'); sendCount(false); paintPad(true); });
    b('#qd-lock', () => sendCount(true));
    b('#qd-perm', async () => { PH.motionAsked = true; try { const r = await DeviceMotionEvent.requestPermission(); PH.motion = r === 'granted'; if (!PH.motion) PH.ctx.toast('No motion? Mash the pad instead!'); } catch { PH.ctx.toast('Mash the pad instead!'); } paintPad(true); });
  }
  const head = (v) => `<div class="qd-ph-top"><span>⭐ <b>${v.points}</b></span><span>${v.rank ? `#${v.rank} of ${v.of}` : ''}</span><span>${v.n}/${v.total}${v.c && v.c.mult > 1 ? ' <i class="qd-x2">×2</i>' : ''}</span></div>`;
  function phone(el, v, ctx) {
    if (!v) return;
    PH.v = v; PH.ctx = ctx; seedClock(v.now);
    if (v.phase !== 'over') maybeSync(() => ctx.act({ op: 'ping' }));
    if (!PH.raf) PH.raf = requestAnimationFrame(phoneLoop);
    bindMotion();
    const V = v.c;
    if (v.phase === 'over') {
      const f = v.final || { standings: [], awards: [] }, mine = f.awards.filter((a) => a.id === v.me);
      feel('over', 'o', v.rank === 1 ? 'win' : 'success');
      PH.wrap = null;
      return BOX.morph(el, `<div class="qd-ph"><div class="qd-ph-end"><div class="qd-ph-medal">${v.rank === 1 ? '🏆' : medal(v.rank - 1)}</div><h2>${v.rank === 1 ? 'Fastest gun in the West!' : `You finished ${ord(v.rank)} of ${v.of}`}</h2><p><b>${v.points}</b> points</p>
        ${mine.length ? `<div class="qd-ph-awards">${mine.map((a) => `<div>${a.icon} <b>${esc(a.title)}</b><small>${esc(a.text)}</small></div>`).join('')}</div>` : ''}</div>
        <div class="qd-ph-board">${f.standings.slice(0, 6).map((r, i) => `<div class="${r.id === v.me ? 'me' : ''}"><span>${i + 1}</span><span>${av(r)} ${esc(r.name)}</span><b>${r.points}</b></div>`).join('')}</div></div>`);
    }
    PH.felt.over = null;
    if (!V) { PH.wrap = null; return BOX.morph(el, `<div class="qd-ph">${head(v)}<div class="qd-ph-card"><h2>Saddle up…</h2></div></div>`); }
    const K = KIND[V.kind];
    if (v.phase === 'intro') {
      PH.wrap = null;
      feel('intro', V.id, 'turn');
      const perm = V.kind === 'shake' && needsPermission() && !PH.motion && !PH.motionAsked;
      BOX.morph(el, `<div class="qd-ph">${head(v)}<div class="qd-ph-card intro k-${V.kind}" id="qd-in-${V.id}"><small>${V.mult > 1 ? '🔥 FINAL SHOWDOWN · ×2' : `Challenge ${v.n} of ${v.total}`}</small><div class="qd-ph-icon">${K.icon}</div><h2>${esc(K.name)}</h2><p>${esc(K.rule)}</p>${perm ? '<button class="qd-perm big" id="qd-perm-i">📳 Allow shaking</button>' : ''}<div class="qd-ph-ready">Get ready…</div></div></div>`);
      const pb = el.querySelector('#qd-perm-i'); if (pb) pb.onclick = async () => { PH.motionAsked = true; try { PH.motion = (await DeviceMotionEvent.requestPermission()) === 'granted'; } catch { PH.motion = false; } haptic(PH.motion ? 'success' : 'select'); ctx.redraw && ctx.redraw(); };
      return;
    }
    if (v.phase === 'result') {
      PH.wrap = null;
      const m = V.mine;
      if (m) feel('res', V.id, m.rank === 0 ? 'win' : m.gain > 0 && m.rank < 3 ? 'success' : m.fs ? 'error' : 'select');
      const lines = m ? [`<div class="qd-ph-gl"><span>${medal(m.rank)} place</span><b>+${m.base}</b></div>`, m.bonus ? `<div class="qd-ph-gl"><span>🔥 ${m.streak} podiums in a row</span><b>+${m.bonus}</b></div>` : '', m.pen ? `<div class="qd-ph-gl bad"><span>💥 ${m.fs} false start${m.fs === 1 ? '' : 's'}</span><b>−${m.pen}</b></div>` : ''].join('') : '';
      return BOX.morph(el, `<div class="qd-ph">${head(v)}<div class="qd-ph-card res ${m && m.rank === 0 ? 'win' : ''}" id="qd-rs-${V.id}"><div class="qd-ph-icon">${m ? medal(m.rank) : K.icon}</div><h2>${m ? esc(m.label) : 'Sat this one out'}</h2>
        ${m ? `<div class="qd-ph-gain ${m.gain < 0 ? 'neg' : ''}">${m.gain >= 0 ? '+' : ''}${m.gain}</div>${lines}` : ''}
        ${V.kind === 'count' && V.answer != null ? `<p>There were <b>${V.answer}</b> 🐔</p>` : ''}${V.top && (!m || m.rank !== 0) ? `<p class="muted">🏆 ${av(V.top)} ${esc(V.top.name)} took it</p>` : ''}${m && m.fs && V.jibe ? `<p class="qd-ph-jibe">${esc(V.jibe)}</p>` : ''}</div></div>`);
    }
    // play: the pad
    if (!V.in) { PH.wrap = null; return BOX.morph(el, `<div class="qd-ph">${head(v)}<div class="qd-ph-card"><div class="qd-ph-icon">👀</div><h2>You joined mid-challenge</h2><p>Watch the TV: you’re in from the next one!</p></div></div>`); }
    const pk = V.id + ':' + V.kind + ':' + (V.kind === 'draw' ? V.heat || V.shot : V.kind === 'copy' ? V.k : '');
    if (PL.key !== pk) {
      const keep = PL.cid === V.id ? { count: PL.count, locked: PL.locked } : {};
      PL = { key: pk, cid: V.id, ...(V.kind === 'count' ? { count: V.count != null ? V.count : keep.count || 0, locked: V.locked || keep.locked || false } : {}), ...(V.kind === 'shake' ? { n: V.n || 0, sent: V.n || 0, fin: V.fin } : {}), ...(V.kind === 'copy' ? { sent: V.sent, acc: V.acc } : {}) };
      if (V.kind === 'draw' && V.my) { PL.tapped = true; if (V.my.false) PL.false = true; else PL.ms = V.my.ms; }
    }
    BOX.morph(el, `<div class="qd-ph play">${head(v)}<div class="qd-ph-title">${K.icon} ${esc(K.name)}</div><div class="qd-padwrap k-${V.kind}" id="qd-padwrap" data-keep></div></div>`);
    const wrap = el.querySelector('#qd-padwrap');
    if (wrap.dataset.k !== pk || !wrap.querySelector('#qd-pad')) { wrap.dataset.k = pk; buildPad(wrap, V); }
    PH.wrap = wrap;
    paintPad(true);
  }

  BOX.games.quickdraw = {
    name: 'Quick Draw', icon: '⚡',
    about: 'A lightning-fast western showdown: DRAW! duels, a green-light lantern, a chicken count, a shake-to-gallop stampede and a copycat drum. Fastest thumb in the West wins.',
    how: [
      '🔫 DRAW!: wait for the signal, then tap first. Tapping early is a false start: you lose the duel and 50 points.',
      '🏮 The Lantern: tap only when the lantern on the TV turns GREEN. Every decoy you tap is a false start.',
      '🐔 Chicken Run: tap +1 for every chicken crossing the street (not the ducks, turkeys or rabbits), then lock in.',
      '🐎 Stampede: shake your phone (or mash the pad) to gallop your horse to the finish.',
      '🥁 Copycat: listen to the drum, then tap the same rhythm back.',
      'Points by rank every challenge (500 for 1st), a podium-streak bonus, double points in the Final Showdown. Most points wins!',
    ],
    fx: { intro: 'whoosh', standoff: 'wind', false: 'boo', duelDone: 'chime', lantern: 'click', chickens: 'rooster', lockin: 'tick', stampede: 'drum', finish: 'pop', listen: 'tick', repeat: 'chime', result: 'reveal', win: 'win' },
    music(s) {
      if (!s) return 'play';
      if (s.phase === 'over') return 'finale';
      if (s.phase === 'result') return 'reveal';
      if (s.phase === 'intro') return 'play';
      const k = s.c && s.c.kind;
      if (k === 'copy') return null; // silence: the drum is the music
      return { draw: 'standoff', flash: 'tense', count: 'think', shake: 'race' }[k] || 'play';
    },
    lobbyTv, tv, phone,
    _test: { SYNC, toLocal, toServer, padLook, TV, PH: () => PH, L },
  };
})();
