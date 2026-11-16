'use strict';
// JustGameBox title screen: pick a game with the mouse, touch, or a TV remote / keyboard.
// Arrow keys move to the nearest tile in that direction (big row on top, small row below).
(function () {
  const tiles = [...document.querySelectorAll('.tile')];
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
  function nearest(dx, dy) {
    const a = tiles[sel].getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = -1, bestD = Infinity;
    tiles.forEach((t, i) => {
      if (i === sel) return;
      const b = t.getBoundingClientRect(), bx = b.left + b.width / 2, by = b.top + b.height / 2;
      const along = (bx - ax) * dx + (by - ay) * dy; if (along <= 4) return;
      const across = Math.abs((bx - ax) * dy) + Math.abs((by - ay) * dx);
      const d = along + across * 2;
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  tiles.forEach((t, i) => {
    t.addEventListener('mouseenter', () => { if (sel !== i) select(i); });
    t.addEventListener('click', (e) => { e.preventDefault(); select(i, false); open(t); });
  });
  document.addEventListener('keydown', (e) => {
    const dir = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[e.key];
    if (dir) { e.preventDefault(); const n = nearest(dir[0], dir[1]); if (n >= 0) select(n); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(tiles[sel]); }
  });
  select(0, false);

  // Show the real join address (the LAN or public URL), so players know where to go.
  fetch('/api/info').then((r) => r.json()).then((i) => { if (i.baseUrl) document.getElementById('join-url').textContent = i.baseUrl.replace(/^https?:\/\//, '') + '/play'; }).catch(() => {});
})();
