'use strict';
// JustZombies: a jukebox-style selector wheel (window.TZWheel). The choices sit round a drum (CSS 3D, rotateY):
// the chosen one big and lit in front, its neighbours curving away smaller and darker. Swipe / drag it (momentum,
// then it snaps to a notch), tap a neighbour, the arrow buttons or the left / right keys; Enter or the big button
// picks. Every notch clicks (a tick sound + a light buzz on phones). Locked choices show greyed with a lock and a
// price and can't be picked. Used by the survivor class picker (trash.js classUi).
//   TZWheel.mount(el, items, o) -> { index(), set(i), destroy() }
//     items: [{ id, icon, name, sub, lines: [text], art: html, locked, cost }]
//     o: { start, title, go: (item) => 'PLAY AS ...', onPick(item), onChange(item, i), tick() }
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  function mount(el, items, o = {}) {
    const n = items.length, step = 360 / Math.max(n, 9), R = 'var(--jz-r)';
    el.innerHTML = `<div class="jz-juke"><div class="jz-marquee">${esc(o.title || 'Pick one')}</div>
      <div class="jz-stage"><button class="jz-arrow l" aria-label="Previous">◀</button><div class="jz-rim"><div class="jz-drum">${items.map((it, i) => `<div class="jz-slot${it.locked ? ' locked' : ''}" data-i="${i}" style="transform: rotateY(${i * step}deg) translateZ(${R})"><div class="jz-label"><div class="jz-disc"><span class="jz-ic">${it.art || esc(it.icon)}</span></div><b>${esc(it.name)}</b>${it.locked ? `<em>🔒 ${it.cost ? it.cost + ' scrap' : 'locked'}</em>` : `<small>${esc(it.sub || '')}</small>`}</div></div>`).join('')}</div></div><button class="jz-arrow r" aria-label="Next">▶</button></div>
      <div class="jz-info"><div class="jz-txt"></div><button class="jz-go btn"></button></div></div>`;
    const drum = el.querySelector('.jz-drum'), rim = el.querySelector('.jz-rim'), slots = [...el.querySelectorAll('.jz-slot')], info = el.querySelector('.jz-txt'), go = el.querySelector('.jz-go');
    let pos = clamp(o.start || 0, 0, n - 1), vel = 0, drag = null, raf = 0, lastNotch = Math.round(pos), dead = false;
    const wrap = (i) => ((i % n) + n) % n, cur = () => wrap(Math.round(pos));
    function paint() {
      drum.style.transform = `translateZ(calc(-1 * ${R})) rotateY(${-pos * step}deg)`;
      slots.forEach((s, i) => { let d = i - pos; d -= Math.round(d / n) * n; const a = Math.abs(d); s.style.opacity = a > 3.2 ? 0 : String(clamp(1 - a * 0.22, 0.15, 1)); s.style.filter = a < 0.5 ? 'none' : `brightness(${clamp(1 - a * 0.25, 0.35, 1)}) saturate(${clamp(1 - a * 0.3, 0.3, 1)})`; s.classList.toggle('on', a < 0.5); s.style.pointerEvents = a > 2.5 ? 'none' : ''; });
      const k = cur(); if (k !== wrap(lastNotch)) { lastNotch = Math.round(pos); if (o.tick) o.tick(); try { if (navigator.vibrate) navigator.vibrate(6); } catch (e) { /* no buzz */ } if (o.onChange) o.onChange(items[k], k); text(); }
    }
    function text() { const it = items[cur()]; info.innerHTML = `<h3>${esc(it.icon)} ${esc(it.name)}</h3>${(it.lines || []).map((l) => `<p>${l}</p>`).join('')}`; go.textContent = it.locked ? `🔒 ${it.cost ? it.cost + ' SCRAP TO UNLOCK' : 'LOCKED'}` : (o.go ? o.go(it) : 'PICK ' + it.name.toUpperCase()); go.disabled = !!it.locked; }
    function anim() {
      raf = 0; if (dead) return;
      if (!drag) { if (Math.abs(vel) > 0.004) { pos += vel; vel *= 0.9; } else { const t = Math.round(pos), d = t - pos; vel = 0; if (Math.abs(d) > 0.002) pos += d * 0.22; else pos = t; } }
      paint(); if (drag || vel || Math.abs(Math.round(pos) - pos) > 0.002) raf = requestAnimationFrame(anim);
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(anim); };
    const set = (i) => { vel = 0; pos = i; kick(); };
    const nudge = (d) => { vel = 0; pos = Math.round(pos) + d; kick(); };
    // drag / swipe: px -> notches (a notch is a card width), momentum on release
    const per = () => Math.max(60, rim.clientWidth * 0.32);
    rim.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, p: pos, t: performance.now(), v: 0, moved: 0, id: e.pointerId }; try { rim.setPointerCapture(e.pointerId); } catch (er) { /* fine */ } kick(); e.preventDefault(); });
    rim.addEventListener('pointermove', (e) => { if (!drag || e.pointerId !== drag.id) return; const now = performance.now(), np = drag.p - (e.clientX - drag.x) / per(); drag.v = (np - pos) / Math.max(1, now - drag.t) * 16; drag.t = now; drag.moved = Math.max(drag.moved, Math.abs(e.clientX - drag.x)); pos = np; kick(); });
    const up = (e) => { if (!drag || (e && e.pointerId !== drag.id)) return; const D = drag; drag = null; if (D.moved < 8) { const s = e && e.target && e.target.closest && e.target.closest('.jz-slot'); if (s) { const i = +s.dataset.i; let d = i - pos; d -= Math.round(d / n) * n; if (Math.abs(d) < 0.5 && !items[i].locked && o.onPick) o.onPick(items[i]); else nudge(Math.round(d)); return; } } vel = clamp(D.v, -0.6, 0.6); kick(); };
    rim.addEventListener('pointerup', up); rim.addEventListener('pointercancel', up);
    el.querySelector('.jz-arrow.l').onclick = (e) => { e.stopPropagation(); nudge(-1); };
    el.querySelector('.jz-arrow.r').onclick = (e) => { e.stopPropagation(); nudge(1); };
    go.onclick = (e) => { e.stopPropagation(); const it = items[cur()]; if (!it.locked && o.onPick) o.onPick(it); };
    const key = (e) => { if (dead || !el.isConnected) return; if (e.key === 'ArrowLeft' || e.key === 'a') { nudge(-1); e.preventDefault(); } else if (e.key === 'ArrowRight' || e.key === 'd') { nudge(1); e.preventDefault(); } else if (e.key === 'Enter' || e.key === ' ') { const it = items[cur()]; if (!it.locked && o.onPick) o.onPick(it); e.preventDefault(); } };
    document.addEventListener('keydown', key, true);
    rim.addEventListener('wheel', (e) => { nudge(e.deltaY > 0 || e.deltaX > 0 ? 1 : -1); e.preventDefault(); }, { passive: false });
    lastNotch = Math.round(pos); paint(); text();
    return { index: cur, set, item: () => items[cur()], destroy() { dead = true; cancelAnimationFrame(raf); document.removeEventListener('keydown', key, true); }, _state: () => ({ pos, vel, drag: !!drag }) };
  }
  window.TZWheel = { mount };
})();
