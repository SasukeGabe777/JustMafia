'use strict';
// JustSketch Relay screens, drawn as an open sketchbook (navy ink, coral, a yellow highlighter,
// sticky notes and tape; see public/box/titles/sketch.js for the look).
// TV lobby: the settings are sticky notes on the page and the players appear as doodle
// portraits. Phone: a full-screen sketchpad overlay (outside the re-rendered body, so redraws
// never wipe a drawing) with 12 colours, 5 brushes, a paint bucket, eraser, undo and redo;
// guess box; voting; live reactions during the reveal; haptics at the big moments. TV: relay
// progress (with last call), then a book-by-book reveal with stroke-by-stroke replays, a
// drift-o-meter, votes, floating reactions, awards, the book of the night and a gallery.
(function () {
  const { esc } = BOX;
  const PAPER = '#fffdf7';
  // Colour codes match the server: 0–7 and 9–12; 8 is the eraser (paper).
  const INK = ['#1d1b26', '#e63946', '#ff8c1a', '#ffd23f', '#2bb673', '#2f7bff', '#8e44ff', '#8b5a2b', PAPER, '#ff7ac6', '#f5c99b', '#9a9aa8', '#7fd3ff'];
  const NAMES = ['Black', 'Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Brown', 'Eraser', 'Pink', 'Skin', 'Grey', 'Sky'];
  const SWATCHES = [0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12];
  const SIZES = [4, 9, 18, 34, 60], ERASER = 8, MAX_STROKES = 400, MAX_POINTS = 8000, MAX_FILLS = 40;
  const colorOf = (c) => INK[c] || '#000';
  const TIPS = ['Stick figures are totally fine!', 'Draw the funniest part BIG.', 'No writing words: that’s cheating 😉', 'Colours help: a yellow sun says “day”.', 'Arrows and speech bubbles (no words) are allowed!', 'Use the bucket to colour in big areas fast.', 'Can’t draw it? Draw something that reminds you of it.'];
  const NOTE = ['#fff27a', '#ffc2d6', '#b8f0c8', '#c9dcff', '#ffd59a', '#e6d2ff'];
  const hashStr = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; };
  const tilt = (seed, max = 3) => (((hashStr(seed) % 1000) / 1000) * 2 - 1) * max;

  // ---------- hand-drawn bits (SVG, ink on paper) ----------
  // A wobbly closed blob (a hand-drawn circle), the same every time for the same seed.
  function blob(seed, cx, cy, r, n = 9, j = 0.1) {
    let s = (seed >>> 0) || 1; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    const p = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, k = r * (1 - j + rnd() * j * 2); p.push([cx + Math.cos(a) * k, cy + Math.sin(a) * k]); }
    const f = (v) => v.toFixed(1), mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let d = `M${mid(p[n - 1], p[0]).map(f).join(' ')}`;
    for (let i = 0; i < n; i++) { const m = mid(p[i], p[(i + 1) % n]); d += ` Q${f(p[i][0])} ${f(p[i][1])} ${f(m[0])} ${f(m[1])}`; }
    return d + 'Z';
  }
  const DOODLES = [
    'M50 8 L61 38 L93 38 L67 57 L77 89 L50 70 L23 89 L33 57 L7 38 L39 38 Z',
    'M50 50 c4 -4 10 0 8 6 c-3 9 -16 8 -18 -2 c-3 -14 14 -22 26 -14 c14 10 8 32 -10 34 c-20 2 -32 -18 -22 -36 c10 -18 38 -18 46 2',
    'M50 85 C20 62 8 45 14 30 C20 15 42 14 50 32 C58 14 80 15 86 30 C92 45 80 62 50 85 Z',
    'M22 70 C8 70 8 50 22 50 C20 34 40 28 48 40 C54 26 76 28 76 46 C92 46 92 70 76 70 Z',
    'M38 70 C38 58 26 52 26 38 C26 22 38 12 50 12 C62 12 74 22 74 38 C74 52 62 58 62 70 Z M40 78 L60 78 M42 86 L58 86',
    'M50 8 C66 24 66 50 62 72 L38 72 C34 50 34 24 50 8 Z M38 56 L26 74 L38 70 M62 56 L74 74 L62 70 M44 74 L50 92 L56 74',
    'M50 34 a16 16 0 1 0 0.1 0 M50 8 L50 20 M50 80 L50 92 M8 50 L20 50 M80 50 L92 50 M20 20 L28 28 M72 72 L80 80 M80 20 L72 28 M28 72 L20 80',
    'M24 30 L30 10 L44 24 C48 23 52 23 56 24 L70 10 L76 30 C86 44 82 74 50 76 C18 74 14 44 24 30 Z M38 46 L38 48 M62 46 L62 48 M44 58 Q50 64 56 58 M30 56 L14 54 M30 62 L14 66 M70 56 L86 54 M70 62 L86 66',
    'M8 50 L92 18 L60 86 L48 60 Z M48 60 L92 18',
  ];
  const doodleSvg = (i, cls = '', col = 'currentColor') => `<svg class="sk-dd ${cls}" viewBox="0 0 100 100" aria-hidden="true"><path pathLength="1" d="${DOODLES[i % DOODLES.length]}" fill="none" stroke="${col}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const PENCIL = '<svg class="sk-pencil" viewBox="0 0 150 24" aria-hidden="true"><path d="M2 12 L24 2 L24 22 Z" fill="#f2c99a" stroke="#2b2a4a" stroke-width="2" stroke-linejoin="round"/><path d="M2 12 L10 8.4 L10 15.6 Z" fill="#2b2a4a"/><rect x="24" y="2" width="94" height="20" fill="#ffc93c" stroke="#2b2a4a" stroke-width="2"/><rect x="25" y="15" width="92" height="6" fill="#e8a91c"/><rect x="118" y="2" width="14" height="20" fill="#b9bcc8" stroke="#2b2a4a" stroke-width="2"/><rect x="132" y="2" width="16" height="20" rx="5" fill="#ff8fa8" stroke="#2b2a4a" stroke-width="2"/></svg>';
  const ARROW = '<svg class="sk-harrow" viewBox="0 0 100 50" aria-hidden="true"><path d="M6 32 Q48 6 90 26 M74 14 L91 27 L72 38" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  // A player as a little doodle portrait: a scribbled head (their avatar is the face) and shoulders in their colour.
  const portrait = (p, seed) => `<svg class="sk-face" viewBox="0 0 100 110" aria-hidden="true"><path d="M14 110 Q16 74 50 72 Q84 74 86 110 Z" fill="${esc(p.color || '#ff8fa8')}" stroke="#2b2a4a" stroke-width="3" stroke-linejoin="round"/><path d="${blob(seed, 50, 42, 31)}" fill="#fffdf4" stroke="#2b2a4a" stroke-width="3.2"/><path d="${blob(seed + 7, 51, 41, 33, 8, 0.08)}" fill="none" stroke="#2b2a4a" stroke-width="1.2" opacity="0.45"/></svg><span class="sk-av">${esc(p.avatar || '🙂')}</span>`;

  // ---------- drawing helpers (phones and TV) ----------
  const countPts = (strokes) => strokes.reduce((n, s) => n + s.p.length / 2, 0);
  function fit(cv) {
    const css = cv.clientWidth || 240, dpr = Math.min(2, window.devicePixelRatio || 1), px = Math.max(60, Math.round(css * dpr));
    if (cv.width !== px) { cv.width = px; cv.height = px; }
    return px;
  }
  const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  // Paint bucket: fill the area around (x, y) that matches the colour there (a little slack for
  // soft line edges), then grow one pixel so no pale halo is left along the lines.
  function floodFill(g, W, x, y, hex) {
    const px = Math.max(0, Math.min(W - 1, Math.round(x))), py = Math.max(0, Math.min(W - 1, Math.round(y)));
    let img; try { img = g.getImageData(0, 0, W, W); } catch { return; }
    const d = img.data, i0 = (py * W + px) * 4, tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2];
    const [fr, fg, fb] = rgbOf(hex);
    if (Math.abs(tr - fr) + Math.abs(tg - fg) + Math.abs(tb - fb) < 6) return;
    const near = (k) => { const i = k * 4; return Math.abs(d[i] - tr) + Math.abs(d[i + 1] - tg) + Math.abs(d[i + 2] - tb) <= 96; };
    const seen = new Uint8Array(W * W), stack = [px, py];
    while (stack.length) {
      const yy = stack.pop(), x0 = stack.pop(), row = yy * W;
      if (seen[row + x0] || !near(row + x0)) continue;
      let xx = x0; while (xx > 0 && !seen[row + xx - 1] && near(row + xx - 1)) xx--;
      let up = false, dn = false;
      for (; xx < W && !seen[row + xx] && near(row + xx); xx++) {
        seen[row + xx] = 1;
        if (yy > 0) { const k = row - W + xx, ok = !seen[k] && near(k); if (ok && !up) { stack.push(xx, yy - 1); up = true; } else if (!ok) up = false; }
        if (yy < W - 1) { const k = row + W + xx, ok = !seen[k] && near(k); if (ok && !dn) { stack.push(xx, yy + 1); dn = true; } else if (!ok) dn = false; }
      }
    }
    for (let k = 0, n = W * W; k < n; k++) {
      if (!seen[k]) { const xx = k % W; if (!((xx > 0 && seen[k - 1] === 1) || (xx < W - 1 && seen[k + 1] === 1) || (k >= W && seen[k - W] === 1) || (k + W < n && seen[k + W] === 1))) continue; seen[k] = 2; }
      const i = k * 4; d[i] = fr; d[i + 1] = fg; d[i + 2] = fb; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  // Draws strokes in order and can stop part-way (replays): adv(n) draws up to n points in total.
  function pen(cv, strokes) {
    const W = fit(cv), g = cv.getContext('2d'), k = W / 1000;
    g.fillStyle = PAPER; g.fillRect(0, 0, W, W); g.lineCap = 'round'; g.lineJoin = 'round';
    const c = { si: 0, pi: 0, done: 0, total: countPts(strokes || []) };
    c.adv = (target) => {
      const list = strokes || [];
      while (c.done < target && c.si < list.length) {
        const s = list[c.si], n = s.p.length / 2;
        if (s.f) { floodFill(g, W, s.p[0] * k, s.p[1] * k, colorOf(s.c)); c.done++; c.si++; c.pi = 0; continue; }
        const upto = Math.min(n, c.pi + (target - c.done));
        g.strokeStyle = g.fillStyle = colorOf(s.c); g.lineWidth = Math.max(1, SIZES[s.s] * k);
        if (n === 1 || (c.pi === 0 && upto === 1)) { g.beginPath(); g.arc(s.p[0] * k, s.p[1] * k, g.lineWidth / 2, 0, Math.PI * 2); g.fill(); }
        if (upto > 1) {
          const from = Math.max(0, c.pi - 1);
          g.beginPath(); g.moveTo(s.p[from * 2] * k, s.p[from * 2 + 1] * k);
          for (let i = from + 1; i < upto; i++) g.lineTo(s.p[i * 2] * k, s.p[i * 2 + 1] * k);
          g.stroke();
        }
        c.done += upto - c.pi; c.pi = upto;
        if (c.pi >= n) { c.si++; c.pi = 0; }
      }
    };
    return c;
  }
  // Paint strokes on a square canvas; frac < 1 draws only the first part.
  function paint(cv, strokes, frac = 1) { const c = pen(cv, strokes); c.adv(frac >= 1 ? Infinity : Math.floor(c.total * frac)); }
  // Replay a drawing stroke by stroke (TV reveal), drawing only what's new each frame.
  function replay(cv, strokes, ms = 1800) {
    const t0 = performance.now(), id = (cv._rp = (cv._rp || 0) + 1), c = pen(cv, strokes);
    const step = () => {
      if (cv._rp !== id || !document.body.contains(cv)) return;
      const f = Math.min(1, (performance.now() - t0) / ms); c.adv(f >= 1 ? Infinity : Math.floor(c.total * f));
      if (f < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const paintAll = (root, list) => { for (const cv of root.querySelectorAll('canvas[data-d]')) { const d = list[Number(cv.dataset.d)]; if (d) paint(cv, d); } };
  // Phones: paint a canvas only when what it shows changed (data-pk), so redraws are free.
  const paintOnce = (cv, key, strokes) => { if (cv && cv._pk !== key) { cv._pk = key; paint(cv, strokes || []); } };

  // Stable countdowns (so a body that hasn't changed isn't rebuilt every second).
  const deadlines = {};
  function deadline(key, endsIn) {
    const d = Date.now() + (endsIn || 0), c = deadlines[key];
    if (c && Math.abs(c - d) < 1500) return c;
    deadlines[key] = d; return d;
  }
  const tspan = (d) => `<span class="timer sk-timer" data-ends="${d}">${BOX.mmss(d - Date.now())}</span>`;
  // TV: rebuild a screen only when its signature changes; returns true when rebuilt.
  function put(el, sig, html) {
    const w = el.firstElementChild;
    if (w && w.classList.contains('sk-root') && w.dataset.sig === sig && el.children.length === 1) return false;
    el.innerHTML = `<div class="sk-root sk-tv" data-sig="${esc(sig)}">${html}</div>`;
    return true;
  }

  // ---------- haptics: each big moment buzzes once ----------
  const buzzed = new Set();
  let epoch = 0, lastPhase = null;
  function buzz(ctx, key, kind) {
    const k = epoch + ':' + key;
    if (buzzed.has(k)) return;
    buzzed.add(k); if (buzzed.size > 300) buzzed.clear();
    try { if (ctx && ctx.haptic) ctx.haptic(kind); } catch { /* none */ }
  }

  // ---------- the phone sketchpad (full-screen overlay) ----------
  const pad = { ov: null, key: null, strokes: [], redo: [], cleared: null, color: 0, size: 1, tool: 'pen', cur: null, deadline: 0, sending: false, tick: 0, ctx: null, warned: false };
  function closePad() {
    if (pad.ov) { pad.ov.remove(); pad.ov = null; }
    clearInterval(pad.tick); pad.tick = 0; pad.key = null; pad.cur = null; pad.sending = false;
    window.removeEventListener('resize', layoutPad);
  }
  function layoutPad() {
    if (!pad.ov) return;
    const ov = pad.ov, cv = ov.querySelector('.sk-pad');
    const used = ov.querySelector('.sk-padhead').offsetHeight + ov.querySelector('.sk-tools').offsetHeight + ov.querySelector('.sk-padfoot').offsetHeight + 54;
    const side = Math.max(160, Math.floor(Math.min(ov.clientWidth - 28, ov.clientHeight - used, 720)));
    cv.style.width = cv.style.height = side + 'px';
    paint(cv, pad.strokes);
  }
  const fills = () => pad.strokes.reduce((n, s) => n + (s.f ? 1 : 0), 0);
  const TOOL_ART = {
    pen: '<svg viewBox="0 0 40 40"><path d="M8 32 L12 22 L28 6 L34 12 L18 28 Z M12 22 L18 28" fill="#ffc93c" stroke="#2b2a4a" stroke-width="2.5" stroke-linejoin="round"/><path d="M8 32 L10 27 L13 30 Z" fill="#2b2a4a"/></svg>',
    fill: '<svg viewBox="0 0 40 40"><path d="M10 16 L22 6 L34 18 L22 30 Z" fill="#7fd3ff" stroke="#2b2a4a" stroke-width="2.5" stroke-linejoin="round"/><path d="M30 24 Q34 30 32 34 Q28 34 30 24 Z" fill="#2f7bff" stroke="#2b2a4a" stroke-width="2"/></svg>',
    eraser: '<svg viewBox="0 0 40 40"><path d="M6 26 L20 10 L34 22 L22 34 L12 34 Z" fill="#ff8fa8" stroke="#2b2a4a" stroke-width="2.5" stroke-linejoin="round"/><path d="M13 19 L27 31" stroke="#2b2a4a" stroke-width="2.5"/></svg>',
    undo: '<svg viewBox="0 0 40 40"><path d="M14 10 L6 18 L14 26 M6 18 L24 18 Q34 18 34 27 Q34 34 26 34" fill="none" stroke="#2b2a4a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    redo: '<svg viewBox="0 0 40 40"><path d="M26 10 L34 18 L26 26 M34 18 L16 18 Q6 18 6 27 Q6 34 14 34" fill="none" stroke="#2b2a4a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    clear: '<svg viewBox="0 0 40 40"><path d="M10 12 L30 12 L28 34 L12 34 Z M7 12 L33 12 M16 12 L17 7 L23 7 L24 12 M17 17 L17 29 M23 17 L23 29" fill="#fffdf4" stroke="#2b2a4a" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  };
  function toolsHtml() {
    const col = pad.tool === 'eraser' ? '#bbb' : INK[pad.color];
    return `<div class="sk-colors">${SWATCHES.map((i) => `<button class="sk-sw ${pad.tool !== 'eraser' && pad.color === i ? 'on' : ''}" data-col="${i}" style="--sw:${INK[i]}" aria-label="${NAMES[i]}"></button>`).join('')}</div>
      <div class="sk-tool-row sk-sizes ${pad.tool === 'fill' ? 'off' : ''}">${SIZES.map((s, i) => `<button class="sk-size ${pad.size === i ? 'on' : ''}" data-size="${i}" aria-label="Brush ${i + 1}"><i style="width:${Math.min(30, 4 + i * 6.5)}px;height:${Math.min(30, 4 + i * 6.5)}px;background:${col}"></i></button>`).join('')}</div>
      <div class="sk-tool-row">
        <button class="sk-tool ${pad.tool === 'pen' ? 'on' : ''}" data-tool="pen">${TOOL_ART.pen}<span>Pen</span></button>
        <button class="sk-tool ${pad.tool === 'fill' ? 'on' : ''}" data-tool="fill">${TOOL_ART.fill}<span>Fill</span></button>
        <button class="sk-tool ${pad.tool === 'eraser' ? 'on' : ''}" data-tool="eraser">${TOOL_ART.eraser}<span>Eraser</span></button>
        <button class="sk-tool" data-tool="undo" ${pad.strokes.length || pad.cleared ? '' : 'disabled'}>${TOOL_ART.undo}<span>Undo</span></button>
        <button class="sk-tool" data-tool="redo" ${pad.redo.length ? '' : 'disabled'}>${TOOL_ART.redo}<span>Redo</span></button>
        <button class="sk-tool" data-tool="clear" ${pad.strokes.length ? '' : 'disabled'}>${TOOL_ART.clear}<span>Clear</span></button></div>`;
  }
  function bindTools() {
    const ov = pad.ov; if (!ov) return;
    const box = ov.querySelector('.sk-tools');
    box.innerHTML = toolsHtml();
    const hap = (k) => { try { pad.ctx && pad.ctx.haptic && pad.ctx.haptic(k); } catch { /* none */ } };
    for (const b of box.querySelectorAll('[data-col]')) b.onclick = () => { pad.color = Number(b.dataset.col); if (pad.tool === 'eraser') pad.tool = 'pen'; hap('select'); bindTools(); };
    for (const b of box.querySelectorAll('[data-size]')) b.onclick = () => { pad.size = Number(b.dataset.size); if (pad.tool === 'fill') pad.tool = 'pen'; hap('select'); bindTools(); };
    for (const b of box.querySelectorAll('[data-tool]')) b.onclick = () => {
      const t = b.dataset.tool, cv = ov.querySelector('.sk-pad');
      if (t === 'pen' || t === 'fill' || t === 'eraser') { pad.tool = t; hap('select'); bindTools(); return; }
      if (t === 'undo') { if (pad.strokes.length) pad.redo.push(pad.strokes.pop()); else if (pad.cleared) { pad.strokes = pad.cleared; pad.cleared = null; } paint(cv, pad.strokes); BOX.sfx('click'); }
      if (t === 'redo' && pad.redo.length) { pad.strokes.push(pad.redo.pop()); paint(cv, pad.strokes); BOX.sfx('click'); }
      if (t === 'clear' && pad.strokes.length) { pad.cleared = pad.strokes; pad.strokes = []; pad.redo = []; paint(cv, pad.strokes); BOX.sfx('poof'); hap('warn'); }
      bindTools();
    };
  }
  function openPad(task, endsIn, ctx) {
    closePad();
    Object.assign(pad, { key: task.key, strokes: [], redo: [], cleared: null, tool: 'pen', ctx, deadline: Date.now() + endsIn, warned: false });
    const ov = document.createElement('div'); ov.className = 'sk-over';
    ov.innerHTML = `<div class="sk-padhead"><div class="sk-padlabel">${task.first ? (task.own ? 'Draw your prompt' : 'Your secret prompt: draw it!') : 'Draw this guess'}</div>
        <div class="sk-padprompt"></div><div class="sk-padtime"><span class="timer" data-ends="${pad.deadline}">${BOX.mmss(endsIn)}</span></div>
        <div class="sk-padtip">${esc(TIPS[Math.floor(Math.random() * TIPS.length)])}</div></div>
      <div class="sk-padwrap"><div class="sk-rings" aria-hidden="true"></div><canvas class="sk-pad"></canvas></div>
      <div class="sk-tools"></div>
      <div class="sk-padfoot"><button class="sk-reroll" hidden>🎲 New prompt</button><button class="sk-done">Done ✓</button></div>`;
    document.body.appendChild(ov); pad.ov = ov;
    updatePad(task, endsIn);
    bindTools();
    const cv = ov.querySelector('.sk-pad'); cv.style.touchAction = 'none';
    const pt = (e) => { const r = cv.getBoundingClientRect(); return [Math.max(0, Math.min(1000, Math.round(((e.clientX - r.left) / r.width) * 1000))), Math.max(0, Math.min(1000, Math.round(((e.clientY - r.top) / r.height) * 1000)))]; };
    const seg = (s, x0, y0, x1, y1) => {
      const g = cv.getContext('2d'), k = cv.width / 1000;
      g.strokeStyle = g.fillStyle = colorOf(s.c); g.lineWidth = Math.max(1, SIZES[s.s] * k); g.lineCap = 'round'; g.lineJoin = 'round';
      if (x0 === x1 && y0 === y1) { g.beginPath(); g.arc(x0 * k, y0 * k, g.lineWidth / 2, 0, Math.PI * 2); g.fill(); return; }
      g.beginPath(); g.moveTo(x0 * k, y0 * k); g.lineTo(x1 * k, y1 * k); g.stroke();
    };
    let full = false;
    const isFull = () => pad.strokes.length >= MAX_STROKES || countPts(pad.strokes) >= MAX_POINTS - 2;
    const changed = () => { pad.cleared = null; if (pad.redo.length) { pad.redo = []; bindTools(); } else if (pad.strokes.length === 1) bindTools(); };
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault(); if (pad.sending) return;
      if (isFull()) { if (!full) { full = true; ctx.toast('The page is full! Press Done.'); ctx.haptic('warn'); } return; }
      const [x, y] = pt(e);
      if (pad.tool === 'fill') {
        if (fills() >= MAX_FILLS) { ctx.toast(`That’s a lot of paint! (max ${MAX_FILLS} fills)`); return; }
        const s = { c: pad.color, s: 0, f: 1, p: [x, y] }; pad.strokes.push(s); changed();
        floodFill(cv.getContext('2d'), cv.width, x * cv.width / 1000, y * cv.width / 1000, colorOf(s.c)); ctx.haptic('tap');
        return;
      }
      try { cv.setPointerCapture(e.pointerId); } catch { /* old browser */ }
      pad.cur = { c: pad.tool === 'eraser' ? ERASER : pad.color, s: pad.size, p: [x, y] }; pad.strokes.push(pad.cur); changed();
      seg(pad.cur, x, y, x, y);
    });
    cv.addEventListener('pointermove', (e) => {
      if (!pad.cur) return; e.preventDefault();
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of evs.length ? evs : [e]) {
        const s = pad.cur, [x, y] = pt(ev), lx = s.p[s.p.length - 2], ly = s.p[s.p.length - 1];
        if (Math.hypot(x - lx, y - ly) < 4) continue;
        if (countPts(pad.strokes) >= MAX_POINTS - 2) { pad.cur = null; ctx.toast('The page is full! Press Done.'); return; }
        s.p.push(x, y); seg(s, lx, ly, x, y);
      }
    });
    const up = () => { pad.cur = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('pointerleave', up);
    ov.querySelector('.sk-done').onclick = () => {
      if (!pad.strokes.length && !confirm('Send a blank page?')) return;
      sendPad(false);
    };
    ov.querySelector('.sk-reroll').onclick = async () => { const r = await ctx.act({ op: 'reroll' }); if (r.ok) { ctx.sfx('shuffle'); ctx.toast('🎲 New prompt!'); ctx.haptic('select'); } };
    window.addEventListener('resize', layoutPad);
    requestAnimationFrame(layoutPad);
    // Time's nearly up: send whatever is on the page so the drawing isn't lost.
    pad.tick = setInterval(() => {
      if (!pad.ov) return;
      const left = pad.deadline - Date.now();
      pad.ov.classList.toggle('hurry', left < 10000);
      if (left < 10000 && left > 900 && !pad.warned) { pad.warned = true; try { pad.ctx.haptic('warn'); } catch { /* none */ } }
      if (left < 900 && !pad.sending) sendPad(true);
      if (left < -6000) closePad();
    }, 200);
  }
  function updatePad(task, endsIn, hurried) {
    const ov = pad.ov; if (!ov) return;
    const p = ov.querySelector('.sk-padprompt'); if (p.textContent !== task.text) { p.textContent = task.text; p.classList.remove('pop'); void p.offsetWidth; p.classList.add('pop'); }
    ov.querySelector('.sk-reroll').hidden = !task.canReroll;
    const d = Date.now() + endsIn;
    if (Math.abs(d - pad.deadline) > 1500) { pad.deadline = d; const t = ov.querySelector('.sk-padtime .timer'); t.dataset.ends = d; }
    const tip = ov.querySelector('.sk-padtip');
    if (hurried && !tip.classList.contains('last')) { tip.classList.add('last'); tip.textContent = '⏰ Last call! Everyone else is done: finish up.'; pad.ctx.haptic('warn'); }
  }
  async function sendPad(auto) {
    if (!pad.ov || pad.sending) return;
    pad.sending = true; pad.cur = null;
    const ctx = pad.ctx, key = pad.key;
    pad.ov.querySelector('.sk-done').textContent = auto ? '⏰ Sending…' : 'Sending…';
    const r = await ctx.act({ op: 'draw', strokes: pad.strokes });
    if (pad.key !== key) return;
    if (r.ok) { closePad(); ctx.sfx('pop'); ctx.haptic('success'); if (auto) ctx.toast('⏰ Time! Your drawing was sent.'); }
    else if (auto) closePad();
    else { pad.sending = false; pad.ov.querySelector('.sk-done').textContent = 'Done ✓'; }
  }

  // ---------- phone (redrawn in place with BOX.morph) ----------
  const drafts = {}; // typed text per task (survives re-renders)
  let promptDraft = '', autoKey = null, autoT = 0;
  const head = (v) => `<div class="sk-me"><span class="sk-pts"><b>${v.points}</b> pts${v.rank ? ` · #${v.rank} of ${v.players}` : ''}</span>${v.phase === 'step' || v.phase === 'pass' ? `<span class="sk-stepchip">step ${Math.min(v.step, v.steps)}/${v.steps}</span>` : v.n ? `<span class="sk-stepchip">book ${v.n}/${v.of}</span>` : ''}</div>`;
  const entryCard = (e, i, pk, opts = {}) => {
    const body = e.kind === 'draw' ? `<canvas class="sk-thumb" data-d="${i}" data-pk="${esc(pk)}"></canvas>${e.auto ? '<div class="sk-ink">(ran out of ink)</div>' : ''}` : `<div class="sk-say ${e.kind === 'prompt' ? 'prompt' : ''}">${esc(e.text)}</div>`;
    return `<button class="sk-entry ${e.kind} ${opts.cls || ''}" ${opts.attrs || ''} style="--r:${tilt(pk, 2).toFixed(1)}deg"><span class="sk-num">${i}</span>${body}<div class="sk-by">${e.kind === 'draw' ? 'drawn by ' : 'guessed by '}${esc(e.by)}${opts.extra || ''}</div></button>`;
  };
  const reactBar = (v) => (v.reacts ? `<div class="sk-reacts">${v.reacts.map((e, i) => `<button data-rx="${i}" aria-label="React ${e}">${e}</button>`).join('')}</div>` : '');
  // A sticky note card on the phone (the main thing on each screen).
  const note = (cls, inner, seed) => `<div class="sk-note ${cls}" style="--r:${tilt(seed || cls, 1.6).toFixed(1)}deg">${inner}</div>`;

  function phone(el, v, ctx) {
    if (!v) return;
    if (lastPhase === 'over' && v.phase !== 'over') epoch++;
    lastPhase = v.phase;
    const t = v.task;
    if (v.phase === 'step' && t && t.kind === 'draw' && !t.done) {
      if (pad.key !== t.key || !pad.ov) { openPad(t, v.endsIn, ctx); buzz(ctx, 'pad:' + t.key, 'turn'); } else updatePad(t, v.endsIn, v.hurried);
    } else if (pad.ov && !pad.sending) closePad();
    else if (pad.ov && v.phase !== 'step') closePad();
    haptics(v, t, ctx);
    const html = screen(v, t);
    BOX.morph(el, `<div class="sk-root sk-phone">${html}</div>`);
    bind(el, v, t, ctx);
  }
  function haptics(v, t, ctx) {
    if (v.phase === 'write' && v.inGame && !v.wrote) buzz(ctx, 'write', 'turn');
    if (v.phase === 'step' && t && t.kind === 'guess' && !t.done) buzz(ctx, 'guess:' + t.key, 'turn');
    if (v.phase === 'step' && t && !t.done && v.hurried) buzz(ctx, 'hurry:' + t.key, 'warn');
    if (v.phase === 'show' && v.mine) buzz(ctx, 'mine:' + v.n, 'big');
    if (v.phase === 'final') buzz(ctx, 'fin:' + v.n, v.survived ? 'success' : 'buzz');
    if (v.phase === 'vote' && v.can && v.can.length) buzz(ctx, 'vote:' + v.n, 'turn');
    if (v.phase === 'results' && v.gain) buzz(ctx, 'gain:' + v.n, 'win');
    if (v.phase === 'over') buzz(ctx, 'over', v.rank === 1 ? 'win' : 'success');
  }
  function screen(v, t) {
    if (v.phase === 'over') {
      const aw = v.awards.map((a) => `<div class="sk-award mine"><span class="ic">${a.icon}</span><div><b>${esc(a.title)}</b><small>${esc(a.detail)}</small></div></div>`).join('');
      return `${head(v)}${note('sk-hero', `<div class="sk-bigrank">#${v.rank}</div><h3>${v.rank === 1 ? 'Relay champion!' : 'That’s a wrap!'}</h3><p>You finished <mark>#${v.rank}</mark> with <b>${v.points}</b> points.</p>`, 'over')}
        ${aw ? `<div class="sk-card"><h3>Your awards</h3>${aw}</div>` : ''}
        ${v.myBook ? `<div class="sk-card"><h3>Your book</h3><div class="sk-chain"><div class="sk-say prompt">${esc(v.myBook.prompt)}</div><div class="sk-arrow">${ARROW}</div><div class="sk-say">${esc(v.myBook.final || '…')}</div></div><p class="sk-center sk-stamp ${v.myBook.survived ? 'ok' : ''}">${v.myBook.survived ? 'It survived the whole ring!' : 'Total chaos!'}</p></div>` : ''}
        <div class="sk-card sk-scores"><h3>Final scores</h3>${BOX.board(v.final, (r) => r.points, '')}</div>`;
    }
    if (v.phase === 'write') {
      if (v.wrote) return `${head(v)}${note('sk-hero', `${doodleSvg(0, 'sk-hero-dd')}<h3>Prompt locked in</h3><div class="sk-say prompt">${esc(v.wrote)}</div><p class="muted">Keep it secret! Waiting for everyone… ${tspan(deadline('w', v.endsIn))}</p>`, 'wrote')}`;
      if (!v.inGame) return `${head(v)}${note('sk-hero', `<h3>You joined mid-game</h3><p>You’ll get to vote on the books when they’re revealed!</p>`, 'mid')}`;
      return `${head(v)}<div class="sk-card sk-write"><div class="sk-padlabel">Write a secret prompt ${tspan(deadline('w', v.endsIn))}</div><p class="muted">Something fun for the next player to draw. Short and drawable!</p>
          <input id="sk-pin" class="sk-input" maxlength="60" placeholder="a walrus in a hot tub" value="${esc(promptDraft)}" autocomplete="off" enterkeyhint="done">
          <button class="sk-btn sk-wide" id="sk-psend">Lock it in ✓</button></div>`;
    }
    if (v.phase === 'pass') return `${head(v)}<div class="sk-passbox"><div class="sk-book"><i></i><i></i><i></i></div><h3>Passing the books…</h3><p>Next up: <mark>${v.nextKind === 'draw' ? 'DRAW' : 'GUESS'}</mark></p></div>`;
    if (v.phase === 'step') {
      if (!t) return `${head(v)}${note('sk-hero', v.inGame ? `${doodleSvg(0, 'sk-hero-dd')}<h3>Your ring is finished!</h3><p>The other rings are still going. Watch the big screen.</p>` : '<h3>You joined mid-game</h3><p>Hang tight: you’ll vote for the funniest entries when the books are revealed!</p>', 'ring')}`;
      if (t.done) { const left = v.total - v.done; return `${head(v)}${note('sk-hero', `${doodleSvg(t.kind === 'draw' ? 5 : 3, 'sk-hero-dd')}<h3>Sent!</h3><p>Waiting for <b>${left}</b> more player${left === 1 ? '' : 's'}…</p>${v.hurried ? '<p class="sk-last">⏰ Last call for the stragglers!</p>' : ''}<p class="muted">Next: ${v.nextKind === 'draw' ? 'you’ll draw someone’s guess' : 'you’ll guess someone’s drawing'}</p>`, 'sent' + t.key)}`; }
      if (t.kind === 'draw') return `${head(v)}${note('sk-hero', '<h3>Your sketchpad is open</h3><p>Draw, then press <b>Done</b>.</p>', 'open')}`;
      const d = deadline(t.key, v.endsIn);
      return `${head(v)}<div class="sk-guess"><div class="sk-padlabel">What is this? ${tspan(d)}</div>
          ${v.hurried ? '<p class="sk-last">⏰ Last call! Everyone else has guessed.</p>' : ''}
          <div class="sk-guesswrap"><canvas class="sk-guesscv" data-pk="${esc(t.key)}"></canvas></div>
          ${t.blank ? '<p class="sk-blank">They ran out of ink! Make something up 😅</p>' : '<p class="muted sk-hint">Say what you see. A wild guess is funnier than a blank!</p>'}
          <input id="sk-gin" class="sk-input" maxlength="60" placeholder="Type your guess" value="${esc(drafts[t.key] || '')}" autocomplete="off" enterkeyhint="send">
          <button class="sk-btn sk-wide" id="sk-gsend">Send guess ✓</button></div>`;
    }
    // The reveal.
    const who = v.mine ? 'your book' : `${esc(v.owner)}’s book`;
    if (v.phase === 'show' || v.phase === 'final') {
      return `${head(v)}${note('sk-hero', `${doodleSvg(8, 'sk-hero-dd')}<h3>Look at the TV!</h3><p>Book ${v.n} of ${v.of}: <mark>${who}</mark></p>${v.phase === 'final' ? `<p class="sk-stamp ${v.survived ? 'ok' : ''}">${v.survived ? 'The chain survived! +50' : 'Total chaos!'}</p>` : v.inBook ? '<p class="muted">You’re in this one… 😬</p>' : ''}`, 'show' + v.n)}
        <p class="sk-center sk-react-lab">React live on the big screen:</p>${reactBar(v)}`;
    }
    if (v.phase === 'vote') {
      const d = deadline('v' + v.n, v.endsIn);
      return `${head(v)}<div class="sk-padlabel">Tap the funniest in ${who} ${tspan(d)}</div>
          <div class="sk-vote">${v.book.entries.map((e, i) => (i === 0 ? '' : entryCard(e, i, `${v.n}:${i}`, { cls: `${v.can.includes(i) ? '' : 'no'} ${v.myVote === i ? 'sel' : ''}`, attrs: `data-v="${i}" ${v.can.includes(i) ? '' : 'disabled'}`, extra: v.can.includes(i) || e.auto ? '' : ' (you)' }))).join('')}</div>
          <p class="muted sk-center">${v.myVote != null ? 'Vote cast ✓ tap another to change it' : v.can.length ? '' : 'Nothing to vote on in your own book: just enjoy it!'}</p>${reactBar(v)}`;
    }
    if (v.phase === 'results') {
      return `${head(v)}${note('sk-hero', v.gain ? `<div class="sk-bigrank">+${v.gain * 100}</div><h3>points for you!</h3><p>${v.gain} vote${v.gain === 1 ? '' : 's'} in ${who}.</p>` : `${doodleSvg(2, 'sk-hero-dd')}<h3>The votes are in</h3><p>See who won on the TV!</p>`, 'res' + v.n)}${reactBar(v)}`;
    }
    return head(v);
  }
  function bind(el, v, t, ctx) {
    for (const b of el.querySelectorAll('[data-rx]')) b.onclick = () => { ctx.act({ op: 'react', e: Number(b.dataset.rx) }); ctx.haptic('tap'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); };
    if (v.phase === 'write') {
      const inp = el.querySelector('#sk-pin');
      if (inp) {
        inp.oninput = () => { promptDraft = inp.value; };
        const go = async () => { promptDraft = inp.value; const r = await ctx.act({ op: 'prompt', text: promptDraft }); if (r.ok) { ctx.sfx('chime'); ctx.haptic('success'); promptDraft = ''; inp.blur(); } };
        el.querySelector('#sk-psend').onclick = go;
        inp.onkeydown = (e) => { if (e.key === 'Enter') go(); };
      }
    }
    if (v.phase === 'step' && t && t.kind === 'guess' && !t.done) {
      paintOnce(el.querySelector('.sk-guesscv'), t.key, t.strokes);
      const inp = el.querySelector('#sk-gin');
      inp.oninput = () => { drafts[t.key] = inp.value; };
      const go = async () => {
        drafts[t.key] = inp.value;
        if (!inp.value.trim()) { ctx.haptic('error'); return ctx.toast('Type your guess first.'); }
        const r = await ctx.act({ op: 'guess', text: inp.value });
        if (r.ok) { ctx.sfx('pop'); ctx.haptic('success'); inp.blur(); }
      };
      el.querySelector('#sk-gsend').onclick = go;
      inp.onkeydown = (e) => { if (e.key === 'Enter') go(); };
      // Time nearly up with something typed: send it.
      const d = deadline(t.key, v.endsIn), ak = t.key + ':' + d;
      if (autoKey !== ak) {
        autoKey = ak; clearTimeout(autoT);
        autoT = setTimeout(() => { const cur = drafts[t.key]; if (cur && cur.trim() && document.body.contains(inp)) ctx.act({ op: 'guess', text: cur }); }, Math.max(0, d - Date.now() - 900));
      }
    }
    if (v.phase === 'vote') {
      for (const cv of el.querySelectorAll('canvas[data-pk]')) { const e = v.book.entries[Number(cv.dataset.d)]; if (e) paintOnce(cv, cv.dataset.pk, e.strokes); }
      for (const b of el.querySelectorAll('[data-v]')) b.onclick = () => { ctx.act({ op: 'vote', entry: Number(b.dataset.v) }); ctx.haptic('select'); ctx.sfx('click'); };
    }
  }
  // The phone lobby (under the shell's "You're in!" card): a warm-up note.
  const lobbyPhone = () => `<div class="sk-note sk-lobbynote" style="--r:1.5deg;--c:#ffc2d6">${doodleSvg(7, 'sk-hero-dd')}<b>Warm up your pencil!</b><p>Stick figures are fine. The worse the drawing, the funnier the guesses.</p></div>`;

  // ---------- TV ----------
  const KIND = { draw: { word: 'DRAW!', tip: 'Draw what your phone tells you!', dd: 5 }, guess: { word: 'GUESS!', tip: 'What on earth is that drawing?', dd: 4 } };
  const DD_SPOTS = [[4, 8, 0], [88, 6, 6], [6, 62, 2], [90, 58, 1], [14, 86, 3], [80, 84, 7], [46, 4, 8], [52, 90, 0]];
  const doodles = () => `<div class="sk-doodles" aria-hidden="true">${DD_SPOTS.map(([x, y, d], i) => `<span style="left:${x}%;top:${y}%;--i:${i}">${doodleSvg(d, '', i % 3 === 0 ? '#ff5a5f' : i % 3 === 1 ? '#3d7bd9' : '#2b2a4a')}</span>`).join('')}</div>`;
  const stageEntry = (e) => {
    if (e.kind === 'prompt') return `<div class="sk-stage-card prompt"><div class="sk-tag">The prompt</div><div class="sk-stage-text">${esc(e.text)}</div></div>`;
    if (e.kind === 'guess') return `<div class="sk-stage-card guess"><div class="sk-tag"><b>${esc(e.by)}</b> guessed…</div><div class="sk-stage-text ${e.auto ? 'auto' : ''}">${esc(e.text)}</div></div>`;
    return `<div class="sk-stage-card draw"><div class="sk-tag"><b>${esc(e.by)}</b> drew…</div><div class="sk-paper"><canvas class="sk-stagecv"></canvas>${e.auto ? '<div class="sk-ink big">(ran out of ink)</div>' : ''}</div></div>`;
  };
  const mini = (e, i, cls = '') => `<div class="sk-mini ${e.kind} ${cls}" style="--r:${tilt(i + e.kind, 4).toFixed(1)}deg">${e.kind === 'draw' ? `<canvas data-d="${i}"></canvas>` : `<span>${esc(e.text)}</span>`}</div>`;
  const chainRow = (b) => `<div class="sk-chainrow">${b.entries.map((e, i) => `${i ? `<span class="sk-arrow">${ARROW}</span>` : ''}<div class="sk-cell ${e.kind}" style="--r:${tilt(b.id + ':' + i, 2.5).toFixed(1)}deg">${e.kind === 'draw' ? `<div class="sk-paper"><canvas data-d="${i}"></canvas></div>` : `<div class="sk-cell-text">${esc(e.text)}</div>`}<div class="sk-by">${i ? esc(e.by) : 'the prompt'}</div></div>`).join('')}</div>`;
  function floats() {
    let f = document.getElementById('sk-floats');
    if (!f) { f = document.createElement('div'); f.id = 'sk-floats'; f.className = 'sk-floats'; document.body.appendChild(f); }
    return f;
  }

  function tv(el, s, ctx) {
    if (!s) return;
    if (s.phase === 'over') return tvOver(el, s, ctx);
    const side = `<aside class="sk-side"><div class="sk-index"><h3>Scores</h3>${BOX.board(s.standings, (r) => r.points, '')}</div></aside>`;
    if (s.phase === 'write') {
      put(el, 'write:' + s.done + ':' + s.waiting.join(','), `<div class="sk-wrap"><section class="sk-relay write">${doodles()}<div class="sk-stepno">Before we start…</div><div class="sk-bigword"><span>WRITE!</span></div><p class="sk-lead">Everyone: write a secret prompt on your phone.</p>
        <div class="sk-count"><b>${s.done} / ${s.of}</b> ready · ${tspan(deadline('tvw', s.endsIn))}</div>${waitHtml(s)}</section>${side}</div>`);
      return;
    }
    if (s.phase === 'step' || s.phase === 'pass') {
      const K = KIND[s.phase === 'pass' ? s.nextKind : s.kind] || KIND.draw;
      const pct = s.of ? Math.round((s.done / s.of) * 100) : 0;
      if (s.phase === 'pass') { put(el, 'pass:' + s.step, `<div class="sk-wrap"><section class="sk-relay sk-pass">${doodles()}<div class="sk-books">${['#ff5a5f', '#3d7bd9', '#2bb673', '#ffc93c'].map((c, i) => `<span style="--i:${i};--c:${c}"></span>`).join('')}</div><div class="sk-bigword"><span>PASS IT ON!</span></div><p class="sk-lead">The books move one seat along… next you <mark>${K === KIND.draw ? 'draw' : 'guess'}</mark>.</p></section>${side}</div>`); return; }
      const dl = deadline('tv' + s.step, s.endsIn);
      put(el, `step:${s.step}:${dl}`, `<div class="sk-wrap"><section class="sk-relay ${s.kind}">${doodles()}<div class="sk-stepno">Step ${s.step} of ${s.steps}${s.rings > 1 ? ` · ${s.rings} rings` : ''}</div>
          <div class="sk-bigword">${doodleSvg(K.dd, 'sk-bw-dd', '#3d7bd9')}<span>${K.word}</span></div><p class="sk-lead">${K.tip}</p><div class="sk-lastcall" hidden>LAST CALL!</div>
          <div class="sk-bar" style="--w:0%"><i></i>${PENCIL}</div><div class="sk-count"><b class="sk-donecount">0 / 0</b> done · ${tspan(dl)}</div><div class="sk-wait"></div></section>${side}</div>`);
      el.querySelector('.sk-bar').style.setProperty('--w', pct + '%');
      el.querySelector('.sk-donecount').textContent = `${s.done} / ${s.of}`;
      el.querySelector('.sk-lastcall').hidden = !s.hurried;
      el.querySelector('.sk-relay').classList.toggle('last', !!s.hurried);
      const wh = waitHtml(s), w = el.querySelector('.sk-wait'); if (w.dataset.h !== wh) { w.dataset.h = wh; w.innerHTML = wh; }
      return;
    }
    const b = s.book; if (!b) return;
    const title = `<div class="sk-bookhead"><span class="sk-bookno">Book ${s.n} of ${s.of}</span><b>${esc(b.owner)}’s book</b></div>`;
    if (s.phase === 'show') {
      const e = b.entries[s.entry];
      if (put(el, `show:${b.id}:${s.entry}`, `<div class="sk-reveal">${title}<div class="sk-strip">${b.entries.slice(0, s.entry).map((x, i) => mini(x, i)).join('')}</div><div class="sk-stage">${stageEntry(e)}</div><div class="sk-dots">${Array.from({ length: b.total }, (_, i) => `<i class="${i <= s.entry ? 'on' : ''}"></i>`).join('')}</div><div class="sk-reacthint">React on your phone!</div></div>`)) {
        paintAll(el, b.entries.map((x) => x && x.strokes));
        const cv = el.querySelector('.sk-stagecv'); if (cv) replay(cv, e.strokes, Math.min(2600, 700 + e.strokes.length * 120));
      }
      return;
    }
    if (s.phase === 'final') {
      const first = b.entries[0], last = b.entries[b.entries.length - 1], drift = s.drift || 0;
      put(el, `final:${b.id}`, `<div class="sk-reveal">${title}<div class="sk-versus ${s.survived ? 'ok' : 'chaos'}">
          <div class="sk-vs-card prompt"><div class="sk-tag">It started as…</div><div class="sk-stage-text">${esc(first.text)}</div></div>
          <div class="sk-vs-arrow">${ARROW}</div>
          <div class="sk-vs-card guess"><div class="sk-tag">…and ended as</div><div class="sk-stage-text">${esc(last.text)}</div></div></div>
          <div class="sk-drift"><span>Drift-o-meter</span><div class="sk-driftbar"><i style="--w:${drift}%"></i></div><b>${drift}%</b></div>
          <div class="sk-verdict big ${s.survived ? 'ok' : ''}">${s.survived ? 'THE CHAIN SURVIVED! +50 each' : drift >= 90 ? 'TOTAL CHAOS!' : 'LOST IN TRANSLATION!'}</div>
          ${s.survived ? confetti() : ''}</div>`);
      return;
    }
    // vote / results: the whole book as a grid.
    const res = s.phase === 'results';
    if (put(el, `${s.phase}:${b.id}`, `<div class="sk-reveal">${title}<div class="sk-status">${res ? 'The funniest entry' : `Vote on your phone for the funniest entry! <span class="sk-voted"></span> ${tspan(deadline('tvv' + b.id, s.endsIn))}`}</div>
        <div class="sk-resrow"><div class="sk-grid" style="--cols:${Math.ceil(b.entries.length / 2)};max-width:${Math.ceil(b.entries.length / 2) * 23}vh">${b.entries.map((e, i) => {
          const top = res && s.top && s.top.includes(i), n = res && s.tally ? s.tally[i] : 0;
          return `<div class="sk-cell ${e.kind} ${top ? 'top' : ''} ${res && !top ? 'dim' : ''}" style="--i:${i};--r:${tilt(b.id + ':' + i, 2.5).toFixed(1)}deg"><span class="sk-num">${i || '★'}</span>${e.kind === 'draw' ? `<div class="sk-paper"><canvas data-d="${i}"></canvas>${e.auto ? '<div class="sk-ink">(ran out of ink)</div>' : ''}</div>` : `<div class="sk-cell-text">${esc(e.text)}</div>`}
            <div class="sk-by">${i ? esc(e.by) : esc(b.owner) + '’s prompt'}</div>${res && i ? `<div class="sk-votes ${n ? '' : 'zero'}">${n ? `${n} vote${n === 1 ? '' : 's'}` : 'no votes'}</div>` : ''}${top ? '<div class="sk-crown">★</div>' : ''}</div>`;
        }).join('')}</div>${res ? `<div class="sk-side-row sk-index"><h3>Scores</h3>${BOX.board(s.standings.slice(0, 6), (r) => r.points, '')}</div>` : ''}</div></div>`)) paintAll(el, b.entries.map((x) => x && x.strokes));
    const vt = el.querySelector('.sk-voted'); if (vt) vt.textContent = `${s.voted}${s.voters ? ' / ' + s.voters : ''} voted`;
  }
  function waitHtml(s) {
    if (!s.waiting || !s.waiting.length) return '<div class="sk-waitlist all">Everyone’s done!</div>';
    return `<div class="sk-waitlist"><span class="sk-waitlab">Still going:</span> ${s.waiting.map((n, i) => `<span class="sk-chip" style="--c:${NOTE[i % NOTE.length]};--r:${tilt(n, 4).toFixed(1)}deg">${esc(n)}</span>`).join('')}${s.more ? `<span class="sk-chip" style="--c:#fff">+${s.more}</span>` : ''}</div>`;
  }
  const confetti = () => `<div class="sk-confetti" aria-hidden="true">${Array.from({ length: 28 }, (_, i) => `<i style="--x:${(i * 37) % 100};--d:${(i % 7) * 0.15}s;--c:${INK[SWATCHES[i % 12]]}"></i>`).join('')}</div>`;

  function tvOver(el, s, ctx) {
    const w = s.standings[0];
    const sig = 'over:' + s.standings.map((r) => r.id + r.points).join(',') + ':' + (s.best ? s.best.id : '');
    if (put(el, sig, `<div class="sk-over-tv"><div class="sk-champ"><div class="sk-starburst" aria-hidden="true"></div><div class="sk-champ-lab">Relay champion</div><h2><span>${esc(w ? w.name : '')}</span></h2></div>
        <div class="sk-awards">${s.awards.map((a, i) => `<div class="sk-award" style="--i:${i};--c:${NOTE[i % NOTE.length]};--r:${tilt(a.title, 3).toFixed(1)}deg"><span class="ic">${a.icon}</span><div><small>${esc(a.title)}</small><b>${esc(a.name)}</b><em>${esc(a.detail)}</em></div></div>`).join('') || '<p class="muted">No awards this time.</p>'}</div>
        ${s.best ? `<div class="sk-best"><h3>Book of the night: <mark>${esc(s.best.owner)}’s book</mark> <span class="muted">(${s.best.votes} vote${s.best.votes === 1 ? '' : 's'})</span></h3>${chainRow(s.best)}</div>` : ''}
        <div class="sk-endgrid"><div class="sk-index"><h3>Final scores</h3>${BOX.board(s.standings, (r) => r.points, ' pts')}</div>
        <div class="sk-index sk-galbox"><h3>The gallery <span class="muted">(click a book)</span></h3><div class="sk-gallery">${s.gallery.map((g, i) => `<button class="sk-gbook ${g.survived ? 'ok' : ''}" data-book="${g.id}" style="--c:${NOTE[i % NOTE.length]}"><b>${esc(g.owner)}</b><span>${esc(g.prompt)}</span><span class="sk-gfin">→ ${esc(g.final)}</span><i>${g.survived ? '✓' : '?!'}</i></button>`).join('')}</div></div></div>
        <div class="sk-modal" hidden></div></div>`)) {
      const bb = el.querySelector('.sk-best'); if (bb) paintAll(bb, s.best.entries.map((x) => x && x.strokes));
      for (const btn of el.querySelectorAll('[data-book]')) btn.onclick = () => openBook(el, Number(btn.dataset.book), ctx);
    }
  }
  async function openBook(el, id, ctx) {
    const m = el.querySelector('.sk-modal'); if (!m || !ctx || !ctx.host) return;
    m.hidden = false; m.innerHTML = '<div class="sk-modal-in"><p>Opening the book…</p></div>';
    const r = await ctx.host('sketchBook', { book: id });
    if (!r || !r.ok) { m.innerHTML = `<div class="sk-modal-in"><p>${esc((r && r.error) || 'Could not open that book.')}</p></div>`; return; }
    const b = r.book;
    m.innerHTML = `<div class="sk-modal-in"><button class="sk-x" aria-label="Close">✕</button><h2>${esc(b.owner)}’s book <span class="sk-stamp ${b.survived ? 'ok' : ''}">${b.survived ? 'survived' : 'chaos'}</span></h2>${chainRow(b)}</div>`;
    paintAll(m, b.entries.map((x) => x && x.strokes));
    BOX.sfx('flip');
    const close = () => { m.hidden = true; m.innerHTML = ''; };
    m.querySelector('.sk-x').onclick = close; m.onclick = (e) => { if (e.target === m) close(); };
  }

  // ---------- TV lobby: the sketchbook page ----------
  // Each setting is a sticky note with a doodle that shows its value; players appear as doodle portraits.
  let lob = null;
  const optIdx = (f, v) => Math.max(0, f.options.findIndex((o) => String(o.value) === String(v)));
  const strip = (s) => String(s).replace(/^[^\p{L}\p{N}]+/u, '').trim();
  const leadEmoji = (s) => { const m = String(s).match(/^(\p{Extended_Pictographic}️?)/u); return m ? m[1] : ''; };
  const ink = (d, w = 3.5, extra = '') => `<path d="${d}" fill="none" stroke="#2b2a4a" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
  function noteArt(f, v, label) {
    const n = Number(v);
    if (f.key === 'ringSize') { // a ring of little heads, as many as the setting
      let o = ink('M50 14 A36 36 0 1 1 49.9 14', 2.5, 'stroke-dasharray="6 7"');
      for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i / n) * Math.PI * 2; o += `<circle cx="${(50 + Math.cos(a) * 36).toFixed(1)}" cy="${(50 + Math.sin(a) * 36).toFixed(1)}" r="8" fill="${INK[[1, 5, 4, 6, 2, 9, 12, 7][i % 8]]}" stroke="#2b2a4a" stroke-width="2.5"/>`; }
      return o + ink('M42 46 Q50 38 58 46 M56 40 L59 47 L52 48', 3);
    }
    if (f.key === 'prompts') return v === 'write'
      ? ink('M18 72 L70 20 L80 30 L28 82 L16 86 Z M62 28 L72 38', 3.5) + ink('M14 92 Q30 86 44 92 T76 92', 2.5)
      : `<rect x="30" y="22" width="44" height="58" rx="5" fill="#fff" stroke="#2b2a4a" stroke-width="3" transform="rotate(10 52 51)"/><rect x="24" y="20" width="44" height="58" rx="5" fill="#fff" stroke="#2b2a4a" stroke-width="3" transform="rotate(-4 46 49)"/>` + ink('M34 38 L58 38 M34 48 L54 48 M34 58 L50 58', 3) + '<text x="46" y="74" font-size="13" text-anchor="middle" fill="#ff5a5f" font-family="Permanent Marker, cursive">?</text>';
    if (f.key === 'pack') return `<text x="50" y="66" font-size="48" text-anchor="middle">${leadEmoji(label) || '🎲'}</text>` + ink(blob(hashStr(label), 50, 50, 40, 10, 0.08), 2.5);
    if (f.key === 'drawSeconds' || f.key === 'guessSeconds') { // a stopwatch whose hand points at the time
      const a = (-90 + (n / 90) * 360) * Math.PI / 180;
      return `<circle cx="50" cy="56" r="32" fill="#fff" stroke="#2b2a4a" stroke-width="3.5"/>` + ink('M44 18 L56 18 M50 18 L50 24 M74 30 L80 24', 3.5)
        + `<path d="M50 56 L50 24 A32 32 0 ${n / 90 > 0.5 ? 1 : 0} 1 ${(50 + Math.cos(a) * 32).toFixed(1)} ${(56 + Math.sin(a) * 32).toFixed(1)} Z" fill="${f.key === 'drawSeconds' ? '#ffd23f' : '#9fd0ff'}" opacity="0.8"/>`
        + ink(`M50 56 L${(50 + Math.cos(a) * 24).toFixed(1)} ${(56 + Math.sin(a) * 24).toFixed(1)}`, 4) + '<circle cx="50" cy="56" r="4" fill="#2b2a4a"/>';
    }
    if (f.key === 'showBooks') { // a pile of books, taller for more
      const k = n === 0 ? 5 : Math.min(5, Math.ceil(n / 1.5)); let o = '';
      for (let i = 0; i < k; i++) o += `<rect x="${22 + (i % 2) * 6}" y="${82 - i * 13}" width="52" height="11" rx="2" fill="${['#ff5a5f', '#3d7bd9', '#2bb673', '#ffc93c', '#8e44ff'][i]}" stroke="#2b2a4a" stroke-width="2.5"/>`;
      return o + (n === 0 ? '<text x="84" y="30" font-size="20" text-anchor="middle" fill="#ff5a5f" font-family="Permanent Marker, cursive">ALL</text>' : '');
    }
    return ink(DOODLES[hashStr(f.key) % DOODLES.length], 3);
  }
  function settingsHtml(L) {
    return L.fields.map((f, i) => {
      const v = L.settings[f.key], k = optIdx(f, v), o = f.options[k] || { label: '' };
      return `<div class="skl-note" data-k="${esc(f.key)}" style="--c:${NOTE[i % NOTE.length]};--r:${tilt(f.key, 2.6).toFixed(1)}deg;--i:${i}">
        <svg class="skl-art" viewBox="0 0 100 100" aria-hidden="true">${noteArt(f, v, o.label)}</svg>
        <div class="skl-lab">${esc(f.label)}</div>
        <div class="skl-val"><button class="skl-arr" data-step="-1" aria-label="Previous">‹</button><span class="skl-cur">${esc(strip(o.label))}<select data-set="${esc(f.key)}" aria-label="${esc(f.label)}">${f.options.map((x) => `<option value="${esc(String(x.value))}" ${String(v) === String(x.value) ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></span><button class="skl-arr" data-step="1" aria-label="Next">›</button></div>
      </div>`;
    }).join('');
  }
  function lobbyTv(el, L) {
    lob = L;
    if (!el.querySelector('.skl')) {
      el.innerHTML = `<div class="skl sk-root">
        <div class="skl-bg" aria-hidden="true">${DD_SPOTS.slice(0, 6).map(([x, y, d], i) => `<span style="left:${x}%;top:${y}%;--i:${i}">${doodleSvg(d, '', i % 2 ? '#3d7bd9' : '#ff5a5f')}</span>`).join('')}</div>
        <section class="skl-left">
          <h1 class="skl-logo"><span class="a">JustSketch</span> <span class="b">Relay</span></h1>
          <div class="skl-how">
            <div class="skl-step" style="--c:#fff27a;--r:-3deg"><b>1</b> Draw your secret prompt</div>${ARROW}
            <div class="skl-step" style="--c:#c9dcff;--r:2deg"><b>2</b> Guess what they drew</div>${ARROW}
            <div class="skl-step" style="--c:#ffc2d6;--r:-2deg"><b>3</b> Watch it fall apart</div>
          </div>
          <h2 class="skl-h">House rules <small>tap a note to change it</small></h2>
          <div class="settings skl-notes" id="settings"></div>
          <h2 class="skl-h">The artists <small class="skl-count"></small></h2>
          <div class="roster skl-roster" id="roster"></div>
        </section>
        <aside class="skl-right">
          <div class="skl-join"><i class="skl-tape a"></i><i class="skl-tape b"></i>
            <div class="skl-scan">Grab your phone &amp; scan</div>
            <img id="qr" alt="QR code to join">
            <div class="skl-or">or go to <b id="skl-url"></b></div>
            <div class="skl-codelab">room code</div>
            <div class="skl-code" id="code"></div>
          </div>
          <div class="skl-vip"></div>
          <div class="skl-lineup"></div>
          <button class="skl-start" id="start">${PENCIL}<span>Start drawing!</span></button>
          <div class="err skl-err" id="lobby-err"></div>
          <div class="skl-links"><button id="add-bots">+ 5 test bots</button><button id="rm-bots">remove bots</button><button id="skl-pick">other game</button></div>
        </aside></div>`;
      el.querySelector('#start').onclick = async () => {
        const r = await lob.start(); const e = el.querySelector('#lobby-err');
        e.textContent = r && r.ok ? '' : (r && r.error) || 'Could not start.';
      };
      el.querySelector('#add-bots').onclick = () => lob.bots(5);
      el.querySelector('#rm-bots').onclick = () => lob.removeBots();
      el.querySelector('#skl-pick').onclick = () => lob.pick();
    }
    const qr = el.querySelector('#qr'); if (qr.dataset.u !== L.joinUrl) { qr.src = L.qr; qr.dataset.u = L.joinUrl; }
    const code = el.querySelector('#code'); if (code.textContent !== L.code) code.textContent = L.code;
    el.querySelector('#skl-url').textContent = L.joinUrl.replace(/^https?:\/\//, '');
    const n = L.players.length;
    el.querySelector('.skl-count').textContent = n ? `${n} in · ${L.max ? 'up to ' + L.max : ''}` : '';
    const st = el.querySelector('#start'); st.disabled = n < L.min;
    st.querySelector('span').textContent = n < L.min ? `Need ${L.min - n} more artist${L.min - n === 1 ? '' : 's'}` : 'Start drawing!';
    BOX.morph(el.querySelector('.skl-vip'), L.vip ? `<b>${esc(L.vip)}</b> is the host and can start from their phone` : 'The first person to join becomes the host');
    BOX.morph(el.querySelector('.skl-lineup'), L.lineupHtml || '');
    // Settings: sticky notes (the real selects sit on the value, so a click opens the list).
    const box = el.querySelector('#settings');
    if (!box.contains(document.activeElement)) BOX.morph(box, settingsHtml(L));
    for (const note of box.querySelectorAll('.skl-note')) {
      const f = L.fields.find((x) => x.key === note.dataset.k); if (!f) continue;
      const sel = note.querySelector('select');
      sel.onchange = () => { sel.blur(); lob.set(f.key, sel.value); BOX.sfx('click'); };
      for (const b of note.querySelectorAll('[data-step]')) b.onclick = (e) => {
        e.stopPropagation();
        const cur = optIdx(f, lob.settings[f.key]), nx = f.options[(cur + Number(b.dataset.step) + f.options.length) % f.options.length];
        lob.set(f.key, String(nx.value)); BOX.sfx('flip');
        note.classList.remove('flip'); void note.offsetWidth; note.classList.add('flip');
      };
    }
    // The artists: doodle portraits (click one to remove that player).
    BOX.morph(el.querySelector('#roster'), L.players.map((p) => `<div class="chip skl-kid ${p.online ? '' : 'off'} ${p.bot ? 'bot' : ''}" data-kick="${esc(p.id)}" title="Click to remove" style="--r:${tilt(p.id, 6).toFixed(1)}deg">${portrait(p, hashStr(p.id))}<b>${esc(p.name)}</b></div>`).join('') || '<div class="skl-empty">Scan the code to join. Your face goes here!</div>');
    for (const c of el.querySelectorAll('#roster [data-kick]')) c.onclick = () => { if (confirm('Remove this player?')) lob.kick(c.dataset.kick); };
    el.querySelector('#roster').classList.toggle('many', n > 14);
  }

  BOX.games.sketch = {
    // Soundtrack cue per phase (public/box/scores/<key>.js); the TV turns the last 10 s of 'think' tense.
    music: (s) => ({ write: 'think', step: 'think', pass: 'play', show: 'reveal', final: 'reveal', vote: 'play', results: 'reveal', over: 'finale' }[s.phase] || 'play'),
    name: 'JustSketch Relay', icon: '🎨',
    about: 'Draw it, guess it, pass it on! Watch a prompt mutate around the ring, react live, then vote for the funniest moment.',
    how: [
      'Everyone gets a secret prompt (or writes one) and draws it on their phone. Pick a prompt pack: “Easy to draw” is great if you can’t draw.',
      'Books pass around your ring: the next player sees only the drawing and guesses what it is…',
      '…the next sees only that guess and draws it. Draw, guess, draw, guess, all the way round.',
      'Then the big screen replays every book, stroke by stroke. React from your phone and watch “a cat on a skateboard” become something else entirely!',
      'Vote for the funniest entry: 100 points per vote. If the final guess still matches the prompt, everyone in that book gets +50.',
    ],
    fx: { draw: 'start', guess: 'chime', hurry: 'tension', pass: 'whoosh', book: 'reveal', flip: 'flip', guessIn: 'pop', survived: 'cheer', chaos: 'laugh', vote: 'ballot', results: 'drum', shrug: 'shrug', win: 'win' },
    onFx(f) {
      if (f.kind !== 'react') return;
      const layer = floats(), e = document.createElement('div');
      e.className = 'sk-float'; e.textContent = f.e; e.style.left = 4 + Math.random() * 90 + '%'; e.style.setProperty('--dx', (Math.random() * 80 - 40).toFixed(0) + 'px');
      layer.appendChild(e); setTimeout(() => e.remove(), 2600);
    },
    tv, phone, lobbyTv,
    lobby: lobbyPhone,
  };
})();
