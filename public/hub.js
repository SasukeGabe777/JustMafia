'use strict';
// JustGameBox title screen: pick a game with the mouse, touch, or a TV remote / keyboard.
(function () {
  const tiles = [...document.querySelectorAll('.tile')];
  const COLS = () => getComputedStyle(document.getElementById('tiles')).gridTemplateColumns.split(' ').length;
  let sel = 0;
  const sfx = (n) => { try { window.SFX && window.SFX.play(n); } catch { /* no audio */ } };

  function select(i, sound = true) {
    sel = Math.max(0, Math.min(tiles.length - 1, i));
    tiles.forEach((t, k) => t.classList.toggle('sel', k === sel));
    tiles[sel].focus({ preventScroll: false });
    if (sound) sfx('pop');
  }
  function open(t) {
    if (t.classList.contains('live')) { sfx('start'); setTimeout(() => { location.href = t.getAttribute('href'); }, 250); }
    else sfx('shrug');
  }

  tiles.forEach((t, i) => {
    t.addEventListener('mouseenter', () => { if (sel !== i) select(i); });
    t.addEventListener('click', (e) => { e.preventDefault(); select(i, false); open(t); });
  });
  document.addEventListener('keydown', (e) => {
    const c = COLS();
    const move = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: c, ArrowUp: -c }[e.key];
    if (move != null) { e.preventDefault(); select(sel + move); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(tiles[sel]); }
  });
  select(0, false);

  // Show the real join address (the LAN or public URL), so players know where to go.
  fetch('/api/info').then((r) => r.json()).then((i) => { if (i.baseUrl) document.getElementById('join-url').textContent = i.baseUrl.replace(/^https?:\/\//, '') + '/play'; }).catch(() => {});
})();
