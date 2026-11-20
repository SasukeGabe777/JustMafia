'use strict';
// Title screens for the small games. Each game registers its own scene and look in
// public/box/titles/<key>.js:
//
//   BOX.titles.<key> = {
//     logo: 'HTML for the logo (spans you can style)',
//     tagline: 'One line under the logo',
//     start: '▶ Button text',            // optional
//     meta: '3–100 players · 10–20 min', // optional
//     font: "'Bungee', sans-serif",       // logo font (see the Google Fonts list in tv.html)
//     theme: { card, ink, muted, accent, button, buttonInk, border }, // CSS colors
//     css: '.bt-<key> .logo .a { … }',   // optional extra CSS, injected once
//     init(W, H) { return state },        // optional: set up the scene
//     draw(g, W, H, t, state) { … },      // draws one frame (CSS pixels; t = seconds)
//   };
//
// BOX.showTitle(el, key, { start, back, resume, code }) draws it full screen.
(function () {
  BOX.titles = BOX.titles || {};
  const { esc } = BOX;
  const injected = new Set();
  let raf = 0;
  function showTitle(el, key, { start, back, resume, code } = {}) {
    const T = BOX.titles[key], G = BOX.games[key];
    if (!T || !G) return false;
    if (T.css && !injected.has(key)) { const st = document.createElement('style'); st.textContent = T.css; document.head.appendChild(st); injected.add(key); }
    const th = T.theme || {};
    const vars = Object.entries({ card: th.card, ink: th.ink, muted: th.muted, accent: th.accent, button: th.button, 'button-ink': th.buttonInk, border: th.border, font: T.font })
      .filter(([, v]) => v).map(([k, v]) => `--bt-${k}:${v}`).join(';');
    el.innerHTML = `<div class="bt bt-${esc(key)}" style="${esc(vars)}"><canvas class="bt-cv"></canvas>
      <div class="bt-card">
        <h1 class="bt-logo">${T.logo || esc(G.name)}</h1>
        <p class="bt-tag">${esc(T.tagline || G.about || '')}</p>
        <div class="bt-btns">
          ${resume ? `<button class="bt-go" id="bt-resume">▶ Continue room ${esc(code || '')}</button>` : ''}
          <button class="bt-go ${resume ? 'alt' : ''}" id="bt-go">${esc(T.start || '▶ Start a room')}</button>
        </div>
        <button class="bt-how-btn" id="bt-how-btn">How to play</button>
        <ol class="bt-how" id="bt-how" hidden>${(G.how || []).map((h) => `<li>${esc(h)}</li>`).join('')}</ol>
        <p class="bt-fine">${esc(T.meta ? T.meta + ' · ' : '')}Everyone plays on their phone.</p>
      </div>
      <button class="bt-back" id="bt-back">◀ All games</button></div>`;
    el.querySelector('#bt-go').onclick = start;
    const rs = el.querySelector('#bt-resume'); if (rs) rs.onclick = resume;
    el.querySelector('#bt-back').onclick = back;
    el.querySelector('#bt-how-btn').onclick = () => { const h = el.querySelector('#bt-how'); h.hidden = !h.hidden; try { BOX.audio.ui(h.hidden ? 'close' : 'open'); } catch { /* no audio */ } };
    // Enter starts (TV remotes / keyboards).
    const card = el.querySelector('.bt');
    const onKey = (e) => { if (!document.body.contains(card)) return document.removeEventListener('keydown', onKey); if (e.key === 'Enter' && !(e.target && e.target.tagName === 'BUTTON')) { e.preventDefault(); (rs || el.querySelector('#bt-go')).click(); } };
    document.addEventListener('keydown', onKey);
    setTimeout(() => (rs || el.querySelector('#bt-go')).focus(), 50);
    // The animated scene.
    const cv = el.querySelector('.bt-cv');
    cancelAnimationFrame(raf);
    let state = null, W = 0, H = 0;
    const t0 = performance.now();
    const step = () => {
      if (!document.body.contains(cv)) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight;
      if (w !== W || h !== H || !state) {
        W = w; H = h; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        try { state = T.init ? T.init(W, H) || {} : {}; } catch (e) { console.error(e); state = {}; }
      }
      const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      try { T.draw(g, W, H, (performance.now() - t0) / 1000, state); } catch (e) { console.error(e); return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return true;
  }
  BOX.showTitle = showTitle;
})();
