'use strict';
// JustSnap: TV and phone screens. SNAP! magazine's office: Margo Flash (the intro's own character,
// BOX.intros.snap.host) hands out assignments; while everyone shoots, the TV is the darkroom
// (prints developing on a line, no photos shown yet); then the gallery wall (anonymous, numbered),
// and the reveal is a magazine spread with the cover shot.
//
// THE PHOTO PIPELINE (phone): a file input (camera: capture="environment" / "user" for selfies,
// or the gallery) -> decode with createImageBitmap(file, { imageOrientation: 'from-image' })
// (an <img> as the fallback; both apply the EXIF rotation) -> canvas, max 1024 px on the long
// side -> JPEG at 0.82 quality, lower until it is ≤ 260 KB (smaller again if needed) + a 360 px
// thumbnail -> preview with Retake / Send -> binary ArrayBuffers over the socket. No camera API
// (getUserMedia needs https, and LAN games are plain http), so it works on every phone.
(function () {
  const { esc, timer } = BOX;
  const face = (p, s = 40) => (p ? (BOX.face ? BOX.face(p, s) : `<span class="sn-emo" style="font-size:${s * 0.8}px">${esc(p.avatar || '🙂')}</span>`) : '');
  const body = (p, h = 120, o) => (p ? (BOX.body ? BOX.body(p, h, o) : `<span class="sn-emo" style="font-size:${h * 0.6}px">${esc(p.avatar || '🙂')}</span>`) : '');
  const img = (url, cls = '', alt = '') => (url ? `<img class="${cls}" src="${esc(url)}" alt="${esc(alt)}" decoding="async" referrerpolicy="no-referrer" draggable="false">` : `<span class="sn-gone ${cls}">🙈</span>`);
  const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const LIMIT = { side: 1024, bytes: 260 * 1024, thumbSide: 360, thumbBytes: 60 * 1024, timeout: 30000 };

  // ---------------- colour (the same formula as the server, for the live meter) ----------------
  function lab([r, g, b]) {
    const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const R = f(r), G = f(g), B = f(b);
    const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, Y = R * 0.2126 + G * 0.7152 + B * 0.0722, Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    const h = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    return [116 * h(Y) - 16, 500 * (h(X) - h(Y)), 200 * (h(Y) - h(Z))];
  }
  const rgbOf = (hex) => { const n = parseInt(String(hex).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  function colourScore(grid, hex) {
    if (!grid || grid.length !== 192) return 0;
    const T = lab(rgbOf(hex)), cells = [];
    for (let i = 0; i < 64; i++) { const L = lab([grid[i * 3], grid[i * 3 + 1], grid[i * 3 + 2]]); cells.push(Math.max(0, 1 - Math.hypot(L[0] - T[0], L[1] - T[1], L[2] - T[2]) / 55)); }
    cells.sort((a, b) => b - a); const top = cells.slice(0, 38);
    return Math.round((100 * top.reduce((a, v) => a + v, 0)) / top.length);
  }

  // ---------------- the photo pipeline ----------------
  async function decode(file) {
    if (window.createImageBitmap) {
      try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* older browsers */ }
      try { return await createImageBitmap(file); } catch (e) { /* not decodable this way */ }
    }
    return new Promise((res, rej) => {
      const u = URL.createObjectURL(file), im = new Image();
      im.onload = () => { res(im); setTimeout(() => URL.revokeObjectURL(u), 2000); };
      im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('decode')); };
      im.style.imageOrientation = 'from-image'; im.src = u;
    });
  }
  const toBlob = (cv, q) => new Promise((res) => {
    try { if (cv.toBlob) return cv.toBlob((b) => res(b), 'image/jpeg', q); } catch (e) { /* fall through */ }
    try { const d = cv.toDataURL('image/jpeg', q), bin = atob(d.split(',')[1]), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); res(new Blob([a], { type: 'image/jpeg' })); } catch (e) { res(null); }
  });
  // Draw to a canvas no bigger than `side`, then JPEG at falling quality until it fits `max` bytes.
  async function encode(src, side, max, qs = [0.82, 0.74, 0.66, 0.58, 0.5, 0.42]) {
    const W0 = src.width || src.naturalWidth, H0 = src.height || src.naturalHeight; let last = null;
    for (let tries = 0; tries < 4; tries++, side = Math.round(side * 0.75)) {
      const k = Math.min(1, side / Math.max(W0, H0)), w = Math.max(1, Math.round(W0 * k)), h = Math.max(1, Math.round(H0 * k));
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const g = cv.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(src, 0, 0, w, h);
      for (const q of qs) { const b = await toBlob(cv, q); if (!b) continue; last = { blob: b, w, h, cv }; if (b.size <= max) return last; }
    }
    return last;
  }
  // The colours of the photo as an 8x8 grid (Colour Match is scored from it on the server).
  function gridOf(cv) {
    const a = document.createElement('canvas'); a.width = a.height = 64; const ga = a.getContext('2d'); ga.imageSmoothingQuality = 'high'; ga.drawImage(cv, 0, 0, 64, 64);
    const b = document.createElement('canvas'); b.width = b.height = 8; const gb = b.getContext('2d'); gb.imageSmoothingQuality = 'high'; gb.drawImage(a, 0, 0, 8, 8);
    const d = gb.getImageData(0, 0, 8, 8).data, out = []; for (let i = 0; i < 64; i++) out.push(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]); return out;
  }
  async function develop(file) {
    if (!file || (file.type && !/^image\//.test(file.type))) throw new Error('That is not a photo.');
    const src = await decode(file).catch(() => { throw new Error('This phone saved the photo in a format we can’t read. Try “Choose from gallery”, or set the camera to “Most compatible”.'); });
    const full = await encode(src, LIMIT.side, LIMIT.bytes), thumb = await encode(full.cv, LIMIT.thumbSide, LIMIT.thumbBytes, [0.72, 0.6, 0.5]);
    try { if (src.close) src.close(); } catch (e) { /* fine */ }
    if (!full || !thumb) throw new Error('Could not develop that photo. Try again.');
    return { url: URL.createObjectURL(full.blob), full: await full.blob.arrayBuffer(), thumb: await thumb.blob.arrayBuffer(), size: full.blob.size, w: full.w, h: full.h, grid: gridOf(full.cv) };
  }

  // ---------------- phone ----------------
  const PH = { round: 0, key: '', pend: null, busy: '', err: '', back: false, el: null, v: null, ctx: null, gi: null, cap: null, peek: false };
  const redraw = () => { if (PH.el && PH.v) phone(PH.el, PH.v, PH.ctx, true); };
  const dropPend = () => { if (PH.pend && PH.pend.url) URL.revokeObjectURL(PH.pend.url); PH.pend = null; };
  async function takeFile(file, slot, v) {
    PH.err = ''; PH.busy = '🧪 Developing…'; dropPend(); redraw();
    try {
      const d = await develop(file);
      const s = (v.slots || []).find((x) => x.slot === slot) || {};
      PH.pend = { slot, ...d, text: (s.saved && s.saved.text) || '', mark: null, match: v.m && v.m.colour ? colourScore(d.grid, v.m.colour.hex) : null };
    } catch (e) { PH.err = e.message || 'Could not read that photo.'; }
    PH.busy = ''; redraw();
  }
  async function sendPend(ctx, v) {
    const P = PH.pend; if (!P || PH.busy) return;
    const s = (v.slots || []).find((x) => x.slot === P.slot) || {};
    if (s.text && P.text.trim().length < 2) { PH.err = v.m.key === 'alphabet' ? `Type what it is (it must start with ${v.m.letter}).` : 'Type what it is: only you know!'; ctx.haptic('error'); return redraw(); }
    if (s.mark && !P.mark) { PH.err = 'Tap the photo where you changed something.'; ctx.haptic('error'); return redraw(); }
    PH.busy = `📤 Sending… (${Math.round(P.size / 1024)} KB)`; PH.err = ''; redraw();
    const once = () => Promise.race([ctx.act({ op: 'photo', round: v.round, slot: P.slot, img: P.full, thumb: P.thumb, text: P.text, mark: P.mark, grid: P.grid }), new Promise((res) => setTimeout(() => res({ ok: false, error: 'The photo didn’t arrive. Check the Wi-Fi and try again.', timeout: true }), LIMIT.timeout))]);
    let r = await once();
    if (r && !r.ok && /moment/i.test(r.error || '')) { await new Promise((res) => setTimeout(res, 1200)); r = await once(); } // sent too quickly after the last one
    PH.busy = '';
    if (r && r.ok) { dropPend(); ctx.haptic('success'); try { ctx.sfx('shutter'); } catch (e) { /* fine */ } }
    else { PH.err = (r && r.error) || 'Couldn’t send. Try again.'; ctx.haptic('error'); }
    redraw();
  }
  const fileInputs = (slot, label, selfie, cls = '') => {
    const cam = selfie && !PH.back ? 'user' : 'environment';
    return `<label class="sn-cam ${cls}"><input class="sn-file" type="file" accept="image/*" capture="${cam}" data-file="${esc(slot)}">📸 ${esc(label)}</label>
      <label class="sn-pick"><input class="sn-file" type="file" accept="image/*" data-file="${esc(slot)}">🖼️ Choose from gallery</label>`;
  };
  const barHtml = (v) => `<div class="sn-bar"><span>${esc(v.m ? v.m.icon : '📸')} <b>${v.round}</b>/${v.of}${v.m ? ` · ${esc(v.m.name)}` : ''}</span><span class="sn-t">${v.endsIn && v.phase !== 'reveal' ? timer(v.endsIn) : ''}</span><b class="sn-pts">★ ${v.points}</b></div>`;
  function briefHtml(v, big) {
    const m = v.m || {};
    let extra = '';
    if (m.key === 'colour' && m.colour) extra = `<div class="sn-swatch" style="--c:${esc(m.colour.hex)}"><i></i><b>${esc(m.colour.name)}</b></div>`;
    if (m.key === 'alphabet') extra = `<div class="sn-letter">${esc(m.letter)}</div>`;
    if (m.key === 'scavenger' && m.items) extra = `<ol class="sn-items">${m.items.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>`;
    if (v.secret) extra = `<div class="sn-secret"><small>🤫 Your secret prompt (don’t show anyone!)</small><b>${esc(v.secret)}</b></div>`;
    if (v.team) extra += `<div class="sn-team" style="--tc:${esc(v.team.color)}"><b>${esc(v.team.name)}</b><span>${v.team.members.map((p) => `${face(p, 26)} ${esc(p.name)}`).join(' · ')}</span></div>`;
    return `<div class="sn-assign ${big ? 'big' : ''}"><div class="sn-a-mode">${esc(m.icon || '')} ${esc(m.name || '')}</div><h2>${esc(m.prompt || '')}</h2>${extra}</div>`;
  }
  function previewHtml(v) {
    const P = PH.pend, s = (v.slots || []).find((x) => x.slot === P.slot) || {}, m = v.m || {};
    const meter = P.match != null ? `<div class="sn-meter"><span>Colour match</span><i style="--w:${P.match}%;--c:${esc(m.colour.hex)}"></i><b>${P.match}%</b></div>` : '';
    const txt = s.text ? `<label class="sn-txt"><span>${m.key === 'alphabet' ? `What is it? (starts with ${esc(m.letter)})` : 'What is it? (the others will guess)'}</span><input id="sn-text" maxlength="${m.key === 'alphabet' ? 30 : 40}" autocomplete="off" value="${esc(P.text)}" placeholder="${m.key === 'alphabet' ? esc(m.letter) + '…' : 'e.g. a toothbrush'}"></label>` : '';
    return `<div class="sn-prev"><div class="sn-prev-h">${esc(s.label || 'Your photo')}${s.mark ? ' · <b>tap what you changed</b>' : ''}</div>
      <div class="sn-prev-img ${s.mark ? 'markable' : ''}" id="sn-prev">${img(P.url, 'sn-pimg')}${P.mark ? `<i class="sn-mk" style="left:${P.mark.x * 100}%;top:${P.mark.y * 100}%"></i>` : ''}</div>
      ${meter}${txt}
      <div class="sn-prev-b"><button class="btn ghost" id="sn-retake">🔁 Retake</button><button class="btn sn-send" id="sn-send" ${PH.busy ? 'disabled' : ''}>✅ Send</button></div></div>`;
  }
  function slotsHtml(v) {
    const m = v.m || {}, selfie = m.key === 'selfie', S = v.slots || [];
    if (m.key === 'change') {
      const [a, b] = S;
      return `<div class="sn-steps">
        <div class="sn-step ${a.done ? 'done' : 'now'}"><b>1</b><div><h4>Snap the scene</h4>${a.done ? `<div class="sn-sent">${img(a.thumb, 'sn-th')}<span>✓ Sent</span></div>` : '<p>Pick a spot with a few things in view.</p>'}${fileInputs('a', a.done ? 'Retake' : 'Take photo', false, a.done ? 'small' : '')}</div></div>
        <div class="sn-step ${b.done ? 'done' : a.done ? 'now' : 'wait'}"><b>2</b><div><h4>Change ONE thing, snap it again</h4>${b.done ? `<div class="sn-sent">${img(b.thumb, 'sn-th')}<span>✓ Sent</span></div>` : '<p>Same spot, same angle. Then tap the thing you changed.</p>'}${a.done ? fileInputs('b', b.done ? 'Retake' : 'Take photo', false, b.done ? 'small' : '') : ''}</div></div></div>`;
    }
    return `<div class="sn-slots ${S.length > 1 ? 'multi' : ''}">${S.map((s) => `<div class="sn-slot ${s.done ? 'done' : ''}">
      ${S.length > 1 ? `<h4>${esc(s.label)}</h4>` : ''}
      ${s.done ? `<div class="sn-sent">${img(s.thumb, 'sn-th')}<span>${s.pending ? '⏳ Waiting for the host’s OK' : '✓ Sent'}${s.by && !s.mine ? ` <small>by ${esc(s.by)}</small>` : ''}${s.saved && s.saved.text ? ` <small>“${esc(s.saved.text)}”</small>` : ''}</span></div>` : ''}
      ${fileInputs(s.slot, s.done ? 'Retake' : selfie ? 'Take selfie' : 'Take photo', selfie, s.done ? 'small' : '')}</div>`).join('')}</div>
      ${selfie ? `<button class="link sn-flip" id="sn-flip">🔄 ${PH.back ? 'Use the front camera' : 'Use the back camera'}</button>` : ''}`;
  }
  function reviewHtml(v) {
    if (!v.review || !v.review.length) return '';
    return `<div class="sn-review"><h4>🛂 Waiting for your OK (${v.review.length})</h4><div class="sn-rv-list">${v.review.map((r) => `<div class="sn-rv">${img(r.thumb, 'sn-th')}<button class="btn small" data-ok="${esc(r.id)}">✓</button><button class="btn small ghost" data-no="${esc(r.id)}">✕</button></div>`).join('')}</div><button class="link" id="sn-okall">✓ OK all of them</button></div>`;
  }
  function bindSnap(el, v, ctx) {
    for (const inp of el.querySelectorAll('[data-file]')) inp.onchange = () => { const f = inp.files && inp.files[0], slot = inp.dataset.file; try { inp.value = ''; } catch (e) { /* fine */ } if (f) { ctx.haptic('tap'); takeFile(f, slot, v); } };
    const q = (s) => el.querySelector(s);
    if (q('#sn-flip')) q('#sn-flip').onclick = () => { PH.back = !PH.back; redraw(); };
    if (q('#sn-retake')) q('#sn-retake').onclick = () => { dropPend(); PH.err = ''; redraw(); };
    if (q('#sn-send')) q('#sn-send').onclick = () => sendPend(ctx, v);
    if (q('#sn-text')) q('#sn-text').oninput = (e) => { if (PH.pend) PH.pend.text = e.target.value; };
    const pv = q('#sn-prev.markable');
    if (pv) pv.onclick = (e) => { const r = pv.getBoundingClientRect(); PH.pend.mark = { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) }; ctx.haptic('select'); redraw(); };
    for (const b of el.querySelectorAll('[data-ok]')) b.onclick = () => ctx.act({ op: 'review', id: b.dataset.ok, ok: true });
    for (const b of el.querySelectorAll('[data-no]')) b.onclick = () => ctx.act({ op: 'review', id: b.dataset.no, ok: false });
    if (q('#sn-okall')) q('#sn-okall').onclick = () => ctx.act({ op: 'reviewAll' });
  }
  // A big look at one photo (tap a thumbnail's 🔍).
  function lightbox(url, caption) {
    let o = document.getElementById('sn-lb');
    if (!o) { o = document.createElement('div'); o.id = 'sn-lb'; o.className = 'sn-lb'; o.onclick = () => { o.hidden = true; }; document.body.appendChild(o); }
    o.innerHTML = `${img(url, 'sn-lb-img')}<p>${esc(caption || '')}</p><small>Tap to close</small>`; o.hidden = false;
  }
  function voteHtml(v) {
    const m = v.m || {}, G = v.gallery || [];
    const head = m.fav && m.flags ? '❤️ Pick your favourite · ❌ flag any that don’t count' : m.flags ? '❌ Flag any photo that isn’t really the item' : m.key === 'caption' ? '❤️ Vote for the best photo + caption' : '❤️ Vote for your favourite';
    const card = (g) => {
      const fav = v.myVote === g.eid, fl = (v.myFlags || []).includes(g.eid);
      return `<div class="sn-card ${g.mine ? 'mine' : ''} ${fav ? 'fav' : ''} ${fl ? 'flagged' : ''}" data-e="${esc(g.eid)}">
        <button class="sn-card-p" data-pick="${esc(g.eid)}" ${g.mine || !m.fav ? 'data-nofav' : ''}>${img(g.thumbs[g.thumbs.length - 1], 'sn-th')}<span class="sn-n">${g.n}</span>${fav ? '<span class="sn-heart">❤️</span>' : ''}${g.mine ? '<span class="sn-yours">Yours</span>' : ''}</button>
        ${g.text ? `<p class="sn-cap">${esc(g.text)}</p>` : ''}
        <div class="sn-card-b"><button class="sn-mini" data-zoom="${esc(g.urls[g.urls.length - 1])}" data-cap="${esc(g.text || '#' + g.n)}">🔍</button>${m.flags && !g.mine ? `<button class="sn-mini ${fl ? 'on' : ''}" data-flag="${esc(g.eid)}">${fl ? '❌ Flagged' : '❌'}</button>` : ''}${v.canHide ? `<button class="sn-mini" data-hide="${esc(g.eid)}">🙈</button>` : ''}</div></div>`;
    };
    let grid;
    if (m.key === 'scavenger' && m.items) grid = m.items.map((t, i) => { const gs = G.filter((g) => g.itemNo === i); return gs.length ? `<h4 class="sn-ih">${i + 1}. ${esc(t)}</h4><div class="sn-grid">${gs.map(card).join('')}</div>` : ''; }).join('');
    else grid = `<div class="sn-grid">${G.map(card).join('')}</div>`;
    const doneBtn = m.flags ? (v.done ? '<p class="sn-done">✓ Done. Watch the TV!</p>' : `<button class="btn sn-send" id="sn-done">✅ ${m.fav ? 'Done' : 'All good, done'}</button>`) : v.myVote ? '<p class="sn-done">✓ Voted. You can change it until time’s up.</p>' : '';
    return `<div class="sn-vote"><h3>${head}</h3>${m.key === 'alphabet' ? `<p class="muted">Everything must start with <b>${esc(m.letter)}</b>.</p>` : ''}${grid}${doneBtn}</div>`;
  }
  function bindVote(el, v, ctx) {
    for (const b of el.querySelectorAll('[data-pick]')) b.onclick = async () => { if (b.hasAttribute('data-nofav')) return; const r = await ctx.act({ op: 'vote', entry: b.dataset.pick }); if (r.ok) ctx.haptic('select'); };
    for (const b of el.querySelectorAll('[data-flag]')) b.onclick = async () => { const on = !b.classList.contains('on'); const r = await ctx.act({ op: 'flag', entry: b.dataset.flag, on }); if (r.ok) ctx.haptic(on ? 'warn' : 'tap'); };
    for (const b of el.querySelectorAll('[data-zoom]')) b.onclick = () => lightbox(b.dataset.zoom, b.dataset.cap);
    for (const b of el.querySelectorAll('[data-hide]')) b.onclick = () => { if (confirm('Hide this photo from everyone?')) ctx.act({ op: 'hide', id: b.dataset.hide }); };
    const d = el.querySelector('#sn-done'); if (d) d.onclick = async () => { const r = await ctx.act({ op: 'done' }); if (r.ok) ctx.haptic('success'); };
  }
  function guessHtml(v) {
    const m = v.m || {}, G = (v.gallery || []).filter((g) => !g.mine), mine = v.myGuesses || {};
    const open = G.filter((g) => mine[g.eid] == null);
    if (!open.length) return `<div class="sn-card-big"><h2>✓ All done!</h2><p>Watch the TV for the answers.</p><div class="sn-strip">${G.map((g) => img(g.thumbs[g.thumbs.length - 1], 'sn-th')).join('')}</div></div>`;
    const g = open.find((x) => x.eid === PH.gi) || open[0]; PH.gi = g.eid;
    const k = G.indexOf(g) + 1;
    const head = `<div class="sn-gh"><b>#${g.n}</b> <span>${k} of ${G.length}</span></div>`;
    if (m.key === 'change') {
      return `<div class="sn-guess">${head}<p class="sn-q">What changed? <b>Tap it on the AFTER photo.</b></p>
        <div class="sn-pair"><figure><figcaption>Before</figcaption>${img(g.urls[0], 'sn-gimg')}</figure></div>
        <div class="sn-pair after"><figure><figcaption>After · tap the change</figcaption><div class="sn-tap" id="sn-tap" data-e="${esc(g.eid)}">${img(PH.peek ? g.urls[0] : g.urls[1], 'sn-gimg')}</div></figure></div>
        <button class="btn ghost sn-peek" id="sn-peek">👀 Hold to flip</button></div>`;
    }
    return `<div class="sn-guess">${head}<p class="sn-q">${m.key === 'selfie' ? 'Which prompt is this face acting out?' : 'What is this close-up?'}</p>
      <div class="sn-gphoto">${img(g.urls[0], 'sn-gimg')}</div>
      <div class="sn-opts">${g.options.map((o, i) => `<button class="btn sn-opt" data-g="${esc(g.eid)}" data-c="${i}">${esc(o)}</button>`).join('')}</div></div>`;
  }
  function bindGuess(el, v, ctx) {
    for (const b of el.querySelectorAll('[data-g]')) b.onclick = async () => { const r = await ctx.act({ op: 'guess', entry: b.dataset.g, choice: Number(b.dataset.c) }); if (r.ok) { ctx.haptic('select'); PH.gi = null; } };
    const t = el.querySelector('#sn-tap');
    if (t) t.onclick = async (e) => { const r = t.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; const res = await ctx.act({ op: 'guess', entry: t.dataset.e, x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) }); if (res.ok) { ctx.haptic('select'); PH.gi = null; } };
    const pk = el.querySelector('#sn-peek');
    if (pk) { const on = (x) => (e) => { e.preventDefault(); if (PH.peek !== x) { PH.peek = x; redraw(); } }; pk.onpointerdown = on(true); pk.onpointerup = pk.onpointerleave = pk.onpointercancel = on(false); }
  }
  function phone(el, v, ctx, local) {
    if (!v) return;
    PH.el = el; PH.v = v; PH.ctx = ctx;
    if (v.round !== PH.round) { PH.round = v.round; dropPend(); PH.err = ''; PH.busy = ''; PH.gi = null; PH.back = false; }
    const key = v.phase + ':' + v.round;
    if (!local && key !== PH.key) {
      PH.key = key;
      if (v.phase === 'brief') ctx.haptic('turn');
      if (v.phase === 'snap') ctx.haptic('big');
      if (v.phase === 'vote' || v.phase === 'guess' || v.phase === 'write') ctx.haptic('turn');
      if (v.phase === 'reveal') ctx.haptic(v.gain > 0 ? 'success' : 'tap');
      if (v.phase === 'over') ctx.haptic(v.rank === 1 ? 'win' : 'success');
    }
    if (v.phase === 'over') {
      const F = v.final || {}, mine = (F.awards || []).filter((a) => a.id === v.me);
      return BOX.morph(el, `<div class="sn-ph"><div class="sn-card-big sn-end"><div class="sn-stamp">THAT’S A WRAP</div><h2>${v.rank === 1 ? '🏆 Photographer of the night!' : `#${v.rank} of ${v.ranked}`}</h2><p class="sn-bign">★ ${v.points}</p>
        ${mine.map((a) => `<div class="sn-aw">${esc(a.icon)} <b>${esc(a.title)}</b> <small>${esc(a.text)}</small></div>`).join('')}
        ${(v.best || []).length ? `<h4>Your photos in the issue</h4><div class="sn-strip">${v.best.map((b) => `<figure>${img(b.url, 'sn-th')}<figcaption>${esc(b.icon)} ${esc(b.prompt)}</figcaption></figure>`).join('')}</div>` : ''}
        <p class="muted">Margo says: darling, you were magnificent.</p></div></div>`);
    }
    let inner = '';
    if (v.phase === 'brief') inner = `${briefHtml(v, true)}<p class="sn-ready">Get your camera ready…</p>`;
    else if (v.phase === 'snap' || v.phase === 'review') {
      const busy = PH.busy ? `<div class="sn-busy"><i></i>${esc(PH.busy)}</div>` : '', err = PH.err ? `<div class="sn-err">${esc(PH.err)}${PH.pend ? ' <button class="link" id="sn-retry">Try again</button>' : ''}</div>` : '';
      if (v.phase === 'review') inner = `${briefHtml(v)}<div class="sn-card-big"><h3>🛂 The host is checking the photos…</h3></div>${reviewHtml(v)}`;
      else if (PH.pend) inner = `${briefHtml(v)}${previewHtml(v)}${busy}${err}${reviewHtml(v)}`;
      else inner = `${briefHtml(v)}${busy}${err}${slotsHtml(v)}${reviewHtml(v)}<p class="sn-priv">🔒 Photos go to this room’s TV only, and are deleted after the round.</p>`;
    } else if (v.phase === 'write') {
      inner = v.capPhoto ? `<div class="sn-write"><h3>💬 Write a caption for this photo</h3><div class="sn-gphoto">${img(v.capPhoto.url, 'sn-gimg')}</div>
        ${v.myCaption && PH.cap == null ? `<p class="sn-done">✓ “${esc(v.myCaption)}”</p><button class="link" id="sn-recap">✏️ Change it</button>` : `<textarea id="sn-capt" maxlength="90" rows="2" placeholder="Make Margo laugh…">${esc(PH.cap || '')}</textarea><button class="btn sn-send" id="sn-capsend">Send caption</button>`}</div>`
        : '<div class="sn-card-big"><h3>✍️ The others are writing captions…</h3><p>Your photo is getting a caption. Watch the TV!</p></div>';
    } else if (v.phase === 'vote') inner = voteHtml(v);
    else if (v.phase === 'guess') inner = guessHtml(v);
    else if (v.phase === 'reveal') {
      const t = v.top;
      inner = `<div class="sn-card-big sn-rev"><div class="sn-gain ${v.gain ? '' : 'zero'}">${v.gain ? '+' + v.gain : '+0'}</div>
        <ul class="sn-notes">${(v.notes || []).map((n) => `<li>${esc(n)}</li>`).join('') || `<li>${v.empty ? 'No photos this round!' : 'No points this round. Next time!'}</li>`}</ul>
        ${(v.mine || []).some((r) => r.rejected) ? '<p class="sn-err">❌ The room rejected one of your photos.</p>' : ''}
        ${t && t.urls && t.urls.length ? `<div class="sn-topph"><small>📰 The cover shot</small>${img(t.urls[t.urls.length - 1], 'sn-th')}<span>${face(t.owner, 26)} ${esc(t.owner.name)}</span></div>` : ''}
        <p class="muted">#${v.rank} of ${v.ranked} · ★ ${v.points}</p>${v.canHide && t ? `<button class="link" data-hide="${esc(t.eid)}">🙈 Hide the cover photo</button>` : ''}</div>`;
    }
    BOX.morph(el, `<div class="sn-ph ph-${esc(v.phase)}">${barHtml(v)}${inner}</div>`);
    if (v.phase === 'snap' || v.phase === 'review') { bindSnap(el, v, ctx); const rt = el.querySelector('#sn-retry'); if (rt) rt.onclick = () => sendPend(ctx, v); }
    if (v.phase === 'vote') bindVote(el, v, ctx);
    if (v.phase === 'guess') bindGuess(el, v, ctx);
    if (v.phase === 'reveal') for (const b of el.querySelectorAll('[data-hide]')) b.onclick = () => { if (confirm('Hide this photo from everyone?')) ctx.act({ op: 'hide', id: b.dataset.hide }); };
    if (v.phase === 'write') {
      const ta = el.querySelector('#sn-capt'); if (ta) ta.oninput = () => { PH.cap = ta.value; };
      const sb = el.querySelector('#sn-capsend'); if (sb) sb.onclick = async () => { const t = (PH.cap || '').trim(); if (t.length < 2) return ctx.toast('Write a caption first!'); const r = await ctx.act({ op: 'caption', text: t }); if (r.ok) { PH.cap = null; ctx.haptic('success'); redraw(); } };
      const rc = el.querySelector('#sn-recap'); if (rc) rc.onclick = () => { PH.cap = v.myCaption || ''; redraw(); };
    }
  }

  // ---------------- TV ----------------
  const TV = { said: null, cv: null, raf: 0, host: null, anim: null, sayUntil: 0, open: false, peek: new Set() };
  function margoSpec() { const I = BOX.intros && BOX.intros.snap; return I && I.host ? I.host : null; }
  function speak(text) {
    try { if (BOX.voice && BOX.voice.speak) BOX.voice.speak(text, (margoSpec() || {}).voice || {}); } catch (e) { /* no voice */ }
    const ms = Math.max(1500, text.length * 62); TV.sayUntil = Date.now() + ms; if (TV.anim) TV.anim.talk(performance.now(), ms);
  }
  function margoLoop() {
    TV.raf = requestAnimationFrame(margoLoop);
    const cv = TV.cv; if (!cv || !cv.isConnected) return;
    const H = margoSpec(); if (!H || !BOX.studio) return;
    if (!TV.host) { try { TV.host = H.draw ? H.draw.bind(H) : BOX.studio.makeHost(H.look || {}); TV.anim = new BOX.studio.HostAnim(H); } catch (e) { return; } }
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
    const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
    const sc = cv.height / 500; g.translate(cv.width / 2, cv.height * 1.0); g.scale(sc, sc);
    if (Date.now() < TV.sayUntil && TV.anim.talkUntil < performance.now()) TV.anim.talk(performance.now(), TV.sayUntil - Date.now());
    try { TV.host(g, TV.anim.frame(performance.now())); } catch (e) { /* drawing */ }
  }
  function mountMargo(el) {
    const box = el.querySelector('#sn-margo'); if (!box) return;
    if (!box.querySelector('canvas')) box.innerHTML = '<canvas></canvas>';
    TV.cv = box.querySelector('canvas');
    if (BOX.studio && BOX.studio.need) BOX.studio.need('snap', () => {});
    if (!TV.raf) TV.raf = requestAnimationFrame(margoLoop);
  }
  // The office: masthead, Margo in her corner with her line, the page in the middle.
  function scene(s, inner, cls = '') {
    const M = s.margo, m = s.m;
    return `<div class="sn-tv ${cls}"><div class="sn-bg"></div>
      <header class="sn-mast"><div class="sn-logo">SNAP!</div><div class="sn-issue"><small>ISSUE</small><b>${s.round || 0}<span>/${s.of}</span></b></div>
        ${m ? `<div class="sn-modebadge">${esc(m.icon)} ${esc(m.name)}</div>` : ''}<div class="sn-clock ${s.endsIn && s.endsIn < 10500 && s.phase === 'snap' ? 'low' : ''}">${s.endsIn && s.phase !== 'reveal' ? timer(s.endsIn) : ''}</div></header>
      <main class="sn-page">${inner}</main>
      <aside class="sn-desk"><div class="sn-margo" id="sn-margo" data-keep></div>${M ? `<div class="sn-bubble" id="sn-mb-${M.key}"><b>Margo Flash</b><p>${esc(M.text)}</p></div>` : ''}</aside></div>`;
  }
  function briefTv(s) {
    const m = s.m || {};
    let extra = '';
    if (m.key === 'colour' && m.colour) extra = `<div class="sn-tswatch" style="--c:${esc(m.colour.hex)}"><i></i><b>${esc(m.colour.name)}</b></div>`;
    if (m.key === 'alphabet') extra = `<div class="sn-tletter">${esc(m.letter)}</div>`;
    if (m.key === 'scavenger') extra = `<ol class="sn-titems">${(m.items || []).map((t) => `<li>${esc(t)}</li>`).join('')}</ol>`;
    if (m.key === 'selfie') extra = '<p class="sn-tnote">🤫 Everyone has a different secret prompt on their phone. Act it out in a selfie!</p>';
    if (m.key === 'closeup') extra = '<p class="sn-tnote">Then type what it is: the others will have to guess.</p>';
    if (m.key === 'change') extra = '<p class="sn-tnote">Snap a scene · change ONE thing · snap it again · tap the change</p>';
    if (m.key === 'caption') extra = '<p class="sn-tnote">Then someone else writes its caption!</p>';
    if (m.teams) extra = `<div class="sn-tteams">${m.teams.map((t) => `<div class="sn-tteam" style="--tc:${esc(t.color)}"><b>${esc(t.name)}</b><div>${t.members.map((p) => `<span>${face(p, 44)}<small>${esc(p.name)}</small></span>`).join('')}</div></div>`).join('')}</div>`;
    return `<div class="sn-brief"><div class="sn-memo"><div class="sn-memo-h">ASSIGNMENT ${s.round} · ${esc(m.icon || '')} ${esc((m.name || '').toUpperCase())}</div><h1>${esc(m.prompt || '')}</h1>${extra}</div></div>`;
  }
  // The darkroom: one print per photographer on the line, developing once they've sent it.
  function snapTv(s) {
    const P = s.progress || {}, m = s.m || {};
    let line;
    if (P.teams) line = (m.teams || []).map((t, i) => { const d = (P.teams.find((x) => x.id === t.id) || {}).done; return `<div class="sn-print ${d ? 'in' : ''}" style="--r:${((i * 37) % 9) - 4}deg;--tc:${esc(t.color)}"><i class="sn-pin"></i><div class="sn-print-ph">${d ? '<span class="sn-dev"></span>' : '<span class="sn-wait">?</span>'}</div><b>${esc(t.name)}</b><small>${t.members.map((p) => face(p, 26)).join('')}</small></div>`; }).join('');
    else line = (P.who || []).map((p, i) => `<div class="sn-print ${p.done ? 'in' : ''} ${p.done >= P.need ? 'full' : ''} ${p.online ? '' : 'off'}" style="--r:${((i * 37) % 9) - 4}deg"><i class="sn-pin"></i><div class="sn-print-ph">${p.done ? '<span class="sn-dev"></span>' : `<span class="sn-face">${face(p, 64)}</span>`}</div><b>${esc(p.name)}</b><small>${P.need > 1 ? `${p.done}/${P.need}` : p.done ? '✓ sent' : 'shooting…'}</small></div>`).join('');
    const sent = P.teams ? P.teams.filter((t) => t.done >= P.need).length : (P.who || []).filter((p) => p.done >= P.need).length, of = P.teams ? P.teams.length : (P.who || []).length;
    const sub = m.key === 'colour' && m.colour ? `<span class="sn-mini-sw" style="--c:${esc(m.colour.hex)}"></span> ${esc(m.colour.name)}` : m.key === 'alphabet' ? `Starts with <b class="sn-bigl">${esc(m.letter)}</b>` : m.key === 'scavenger' ? (m.items || []).map((t, i) => `${i + 1}. ${esc(t)}`).join(' · ') : esc(m.prompt || '');
    return `<div class="sn-dark"><div class="sn-safelight"></div><div class="sn-dh"><h2>${s.phase === 'review' ? '🛂 The host is checking the photos…' : '📸 Go! Grab your phone and shoot!'}</h2><p>${sub}</p></div>
      <div class="sn-line"><div class="sn-wire"></div>${line}</div>
      <div class="sn-count"><b>${sent}</b> of ${of} ${P.teams ? 'teams' : 'photographers'} done${P.pending ? ` · <span class="sn-pend">⏳ ${pl(P.pending, 'photo')} waiting for the host</span>` : ''}</div></div>`;
  }
  function whoHtml(P) { return P && P.who ? `<div class="sn-who">${P.who.map((p) => `<span class="${p.done ? 'done' : ''}">${face(p, 34)}${p.done ? '<i>✓</i>' : ''}</span>`).join('')}</div>` : ''; }
  function writeTv(s) { return `<div class="sn-wall"><div class="sn-wh"><h2>✍️ Everyone is captioning someone else’s photo…</h2></div>${whoHtml(s.progress)}<div class="sn-typewriter">💬</div></div>`; }
  // The gallery wall: anonymous, numbered.
  function galleryTv(s) {
    const m = s.m || {}, G = s.gallery || [], n = G.length;
    const cols = m.key === 'change' ? (n <= 2 ? n : n <= 4 ? 2 : 3) : n <= 2 ? n : n <= 4 ? 2 : n <= 6 ? 3 : n <= 8 ? 4 : n <= 12 ? 4 : 5;
    const card = (g, i) => `<figure class="sn-frame" style="--d:${i * 70}ms;--r:${((i * 53) % 7) - 3}deg"><span class="sn-tag">${g.n}</span>
      ${m.key === 'change' ? `<div class="sn-ab">${img(g.urls[0], 'sn-fimg')}${img(g.urls[1], 'sn-fimg')}</div>` : img(g.urls[g.urls.length - 1], 'sn-fimg')}
      ${g.text ? `<figcaption>${esc(BOX.filterText ? BOX.filterText(g.text) : g.text)}</figcaption>` : g.item ? `<figcaption class="it">${esc(g.item)}</figcaption>` : ''}
      <button class="sn-hide" data-hide="${esc(g.eid)}" title="Hide this photo">🙈</button></figure>`;
    const head = s.phase === 'guess' ? (m.key === 'change' ? '🔎 What changed? Tap it on your phone!' : m.key === 'selfie' ? '🤳 Who is acting what? Guess on your phone!' : '🔬 What are these? Guess on your phone!')
      : m.flags && !m.fav ? '❌ Does every photo count? Flag the fakes on your phone!' : '❤️ Vote for your favourite on your phone!';
    return `<div class="sn-wall"><div class="sn-wh"><h2>${head}</h2>${m.key === 'colour' && m.colour ? `<span class="sn-mini-sw big" style="--c:${esc(m.colour.hex)}"></span>` : ''}</div>
      <div class="sn-gal" style="--cols:${cols};--rows:${Math.ceil(n / cols)}">${G.map(card).join('')}</div>${whoHtml(s.progress)}</div>`;
  }
  function revealTv(s) {
    const m = s.m || {}, rows = s.rows || [];
    if (s.empty || !rows.length) return `<div class="sn-wall"><div class="sn-empty"><h1>No photos this round!</h1><p>Margo is not amused.</p></div></div>`;
    const top = rows.find((r) => r.cover) || rows[0], rest = rows.filter((r) => r !== top);
    const who = (r) => (r.team ? `<span class="sn-teamn" style="--tc:${esc(r.team.color)}">${esc(r.team.name)}</span>` : `${face(r.owner, 40)} <b>${esc(r.owner.name)}</b>`);
    const facts = (r) => {
      const a = [];
      if (m.after === 'guess') { if (m.key !== 'change') a.push(`<em>“${esc(r.answerText || '')}”</em>`); a.push(`${r.correct}/${r.of} got it`); }
      else if (m.key === 'scavenger') a.push(r.rejected ? '❌ rejected' : `✓ ${esc(r.item || '')}${r.rank === 1 ? ' · ⚡ first!' : ''}`);
      else { if (m.key === 'colour') a.push(`🎨 ${r.match}%`); a.push(`❤️ ${r.votes}`); if (r.rejected) a.push('❌ rejected'); }
      if (m.key === 'caption' && r.writer) a.push(`✍️ ${esc(r.writer.name)}`);
      return a.join(' · ');
    };
    const pic = (r, cls) => {
      if (r.hidden || !r.urls.length || !r.urls[r.urls.length - 1]) return `<div class="sn-hidden ${cls}">🙈 hidden</div>`;
      const u = r.urls[r.urls.length - 1];
      if (m.key === 'change' && r.mark) return `<div class="sn-markwrap ${cls}">${img(u, 'sn-fimg')}<i class="sn-mk big" style="left:${r.mark.x * 100}%;top:${r.mark.y * 100}%"></i>${(r.taps || []).map((t) => `<i class="sn-tapdot ${t.hit ? 'hit' : ''}" style="left:${t.x * 100}%;top:${t.y * 100}%;--c:${esc(t.color || '#fff')}"></i>`).join('')}</div>`;
      return img(u, 'sn-fimg ' + cls);
    };
    const capOf = (r) => (m.key === 'caption' || m.key === 'alphabet' ? r.text : m.key === 'scavenger' ? r.item : '');
    return `<div class="sn-spread"><div class="sn-cover"><div class="sn-cover-h">${top.cover ? 'COVER SHOT' : 'TOP SHOT'}</div><div class="sn-cover-ph">${pic(top, 'big')}${capOf(top) ? `<div class="sn-cover-cap">${esc(BOX.filterText ? BOX.filterText(capOf(top)) : capOf(top))}</div>` : ''}</div>
        <div class="sn-cover-by">${who(top)} <span class="sn-gainb">+${top.gain}</span></div><div class="sn-cover-f">${facts(top)}</div>${top.voters && top.voters.length ? `<div class="sn-voters">${top.voters.map((p) => face(p, 30)).join('')}</div>` : ''}<button class="sn-hide" data-hide="${esc(top.eid)}" title="Hide this photo">🙈</button></div>
      <div class="sn-rest" style="--cols:${rest.length <= 2 ? 1 : rest.length <= 4 ? 2 : 3};--rows:${Math.max(1, Math.ceil(Math.min(rest.length + (rest.length > 9 ? 1 : 0), 9) / (rest.length <= 2 ? 1 : rest.length <= 4 ? 2 : 3)))}">${rest.slice(0, 9).map((r, i) => `<figure class="sn-mini-f ${r.rejected ? 'rej' : ''}" style="--d:${300 + i * 110}ms">${pic(r, '')}<figcaption><span>${who(r)}</span><small>${facts(r)}</small><b>+${r.gain}</b></figcaption>${capOf(r) ? `<p>${esc(BOX.filterText ? BOX.filterText(capOf(r)) : capOf(r))}</p>` : ''}</figure>`).join('')}${rest.length > 9 ? `<div class="sn-more">+${rest.length - 9} more</div>` : ''}</div>
      <div class="sn-board">${(s.standings || []).slice(0, 6).map((r, i) => `<span>${i + 1}. ${face(r, 26)} ${esc(r.name)} <b>${r.points}</b></span>`).join('')}</div></div>`;
  }
  function overTv(s) {
    const st = (s.final && s.final.standings) || s.standings || [], B = s.best || [], pod = st.slice(0, 3), order = [1, 0, 2].filter((i) => pod[i]);
    return `<div class="sn-final"><div class="sn-mag"><div class="sn-mag-logo">SNAP!</div><div class="sn-mag-sub">THE BEST PHOTOS OF THE NIGHT</div>
        <div class="sn-mag-grid n${Math.min(B.length, 6)}">${B.slice(0, 6).map((b, i) => `<figure style="--d:${i * 160}ms">${img(b.url, 'sn-fimg')}<figcaption>${esc(b.icon)} ${esc(b.caption || b.prompt)} <small>📸 ${esc(b.owner.name)}</small></figcaption></figure>`).join('') || '<p>No photos survived the night.</p>'}</div></div>
      <div class="sn-fside"><h2>🏆 ${esc((st[0] || {}).name || '')}<small>Photographer of the night</small></h2>
        <div class="sn-podium">${order.map((i) => `<div class="sn-pod p${i + 1}"><div class="sn-pav">${body(pod[i], 150)}</div><b>${esc(pod[i].name)}</b><span>★ ${pod[i].points}</span><div class="sn-step">${i + 1}</div></div>`).join('')}</div>
        <div class="sn-awards">${(s.awards || []).map((a) => `<div class="sn-award"><i>${esc(a.icon)}</i><b>${esc(a.title)}</b><span>${face(a, 26)} ${esc(a.name)}</span><small>${esc(a.text)}</small></div>`).join('')}</div>
        <div class="sn-rest2">${st.slice(3, 10).map((r, i) => `<span>${i + 4}. ${esc(r.name)} <b>${r.points}</b></span>`).join('')}</div></div></div>`;
  }
  // The host's checks (TV ⚙): photos waiting for an OK, blurred until clicked.
  function reviewTv(s) {
    if (!s.review || !s.review.length) return '';
    return `<div class="sn-hostq ${TV.open ? 'open' : ''}"><button class="sn-hostq-b" id="sn-hq">🛂 ${pl(s.review.length, 'photo')} to check</button>
      ${TV.open ? `<div class="sn-hostq-p"><p>Click a photo to see it. ✓ shows it to the room, ✕ throws it away.</p><div>${s.review.map((r) => `<div class="sn-hq ${TV.peek.has(r.id) ? 'peek' : ''}" data-peek="${esc(r.id)}">${img(r.thumb, 'sn-th')}<button data-tok="${esc(r.id)}">✓</button><button data-tno="${esc(r.id)}">✕</button></div>`).join('')}</div><button class="sn-okall" id="sn-tokall">✓ OK all</button></div>` : ''}</div>`;
  }
  function bindTv(el, s, ctx) {
    const host = ctx && ctx.host;
    if (!host) return;
    for (const b of el.querySelectorAll('[data-hide]')) b.onclick = (e) => { e.stopPropagation(); if (confirm('Hide this photo from everyone?')) host('snapHide', { id: b.dataset.hide }); };
    const hq = el.querySelector('#sn-hq'); if (hq) hq.onclick = () => { TV.open = !TV.open; BOX.games.snap.tv(el, s, ctx); };
    for (const b of el.querySelectorAll('[data-peek]')) b.onclick = () => { TV.peek.add(b.dataset.peek); b.classList.add('peek'); };
    for (const b of el.querySelectorAll('[data-tok]')) b.onclick = (e) => { e.stopPropagation(); host('snapOk', { id: b.dataset.tok, ok: true }); };
    for (const b of el.querySelectorAll('[data-tno]')) b.onclick = (e) => { e.stopPropagation(); host('snapOk', { id: b.dataset.tno, ok: false }); };
    const all = el.querySelector('#sn-tokall'); if (all) all.onclick = () => host('snapOkAll', {});
  }

  function lobbyTv(el, L) {
    if (!el.querySelector('.sn-lobby')) {
      el.innerHTML = `<div class="sn-lobby"><div class="sn-bg"></div>
        <div class="sn-l-head"><div class="sn-logo big">SNAP!</div><p>Margo Flash needs photographers for the next issue. Grab your phone: you’re about to run around the house with your camera.</p></div>
        <div class="sn-l-main">
          <div class="sn-l-desk"><h2>The assignment desk</h2><div class="sn-l-set" id="settings"></div><div class="sn-l-err" id="lobby-err"></div>
            <button class="sn-l-start" id="start">📸 Start the shoot</button><div class="sn-l-links"><button class="link" id="add-bots">+ 5 test bots</button> <button class="link" id="pick">🎮 Another game</button></div></div>
          <div class="sn-l-pol"><div class="sn-l-polimg"><img id="qr" alt="QR code to join"></div><div class="sn-l-cl">Scan to join · room code</div><div class="sn-l-code" id="code"></div></div>
        </div>
        <div class="sn-l-sheet"><div class="sn-l-sh">CONTACT SHEET</div><div class="sn-l-roster" id="roster"></div></div></div>`;
      el.querySelector('#start').onclick = async () => { const r = await L.start(); el.querySelector('#lobby-err').textContent = r && r.ok ? '' : (r && r.error) || ''; };
      el.querySelector('#add-bots').onclick = () => L.bots(5);
      el.querySelector('#pick').onclick = () => L.pick();
    }
    el.querySelector('#code').textContent = L.code;
    const q = el.querySelector('#qr'); if (q.dataset.u !== L.qr) { q.src = L.qr; q.dataset.u = L.qr; }
    const set = el.querySelector('#settings'), sig = JSON.stringify(L.settings);
    if (set.dataset.sig !== sig && !set.contains(document.activeElement)) {
      set.dataset.sig = sig;
      set.innerHTML = L.fields.map((f) => `<label class="sn-l-f"><span>${esc(f.label)}</span><select data-set="${esc(f.key)}">${f.options.map((o) => `<option value="${esc(String(o.value))}" ${String(L.settings[f.key]) === String(o.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`).join('');
      for (const s of set.querySelectorAll('[data-set]')) s.onchange = () => L.set(s.dataset.set, s.value);
    }
    BOX.morph(el.querySelector('#roster'), L.players.map((p, i) => `<span class="chip sn-l-frame" style="--r:${((i * 37) % 7) - 3}deg">${face(p, 72)}<small>${esc(p.name)}</small><i>${String(i + 1).padStart(2, '0')}A</i></span>`).join('') || '<span class="sn-l-empty">Scan the code to join the shoot. 3–10 photographers is perfect.</span>');
  }

  BOX.games.snap = {
    name: 'JustSnap', icon: '📸',
    about: 'Margo Flash needs photos for SNAP! magazine. Everyone runs around taking photos on their phone; they pop up on the TV and the room votes or guesses.',
    how: [
      'Margo Flash, editor of SNAP! magazine, gives an assignment: a thing to find, a colour, a letter, a face to pull…',
      'Run around and take a photo with your phone (📸 Take photo), check the preview, and tap ✅ Send. It goes to the TV, nowhere else.',
      'The photos go up on the TV with numbers, no names. Vote for your favourite (never your own) or guess what each one is.',
      'Modes: Photo Hunt, Scavenger Race, Close-Up Mystery, Colour Match, Selfie Faces, Tiny Giants, Caption This, Spot the Change, Alphabet Hunt, Team Recreate, or Mixed.',
      'The host can hide any photo (🙈), and can turn on “Host approves photos” to check every photo first.',
      'Votes, right guesses and speed earn stars; the best photo of each round goes in the final issue. Most stars wins.',
    ],
    fx: { start: 'start', brief: 'whoosh', snap: 'shutter', warn: 'tick', sent: 'shutter', review: 'chime', write: 'pop', gallery: 'reveal', hidden: 'poof', reveal: 'drum', win: 'win' },
    music: (s) => (s.phase === 'brief' || s.phase === 'snap' ? 'play' : s.phase === 'vote' || s.phase === 'guess' || s.phase === 'write' || s.phase === 'review' ? 'think' : s.phase === 'reveal' ? 'reveal' : s.phase === 'over' ? 'finale' : undefined),
    lobbyTv,
    _test: { colourScore, encode, develop },
    tv(el, s, ctx) {
      if (!s) return;
      if (BOX.voice && BOX.voice.preload && !TV.pre) { TV.pre = true; try { BOX.voice.preload('snap'); } catch (e) { /* no */ } }
      if (s.margo && TV.said !== s.margo.key) { TV.said = s.margo.key; speak(s.margo.text); }
      if (!(s.review && s.review.length)) { TV.open = false; }
      let inner = '';
      if (s.phase === 'over') inner = overTv(s);
      else if (s.phase === 'brief') inner = briefTv(s);
      else if (s.phase === 'snap' || s.phase === 'review') inner = snapTv(s);
      else if (s.phase === 'write') inner = writeTv(s);
      else if (s.phase === 'vote' || s.phase === 'guess') inner = galleryTv(s);
      else if (s.phase === 'reveal') inner = revealTv(s);
      BOX.morph(el, scene(s, inner + reviewTv(s), 'ph-' + s.phase));
      mountMargo(el);
      bindTv(el, s, ctx);
    },
    phone,
  };
})();
