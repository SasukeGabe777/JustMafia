'use strict';
// JustGameBox client helpers shared by the TV and phones: escaping, playing cards,
// countdowns and the per-game renderer registry (window.BOX.games[key]).
window.BOX = (function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ICON = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const seen = new Set();
  // A card face from 'QH' / '10S' ('??' = face down). opts: size (sm|xs|lg), sel, fresh, attrs.
  function card(c, opts = {}) {
    const cls = ['pc']; if (opts.size) cls.push(opts.size); if (opts.sel) cls.push('sel');
    if (opts.anim && !seen.has(opts.anim)) { seen.add(opts.anim); cls.push('fresh'); }
    if (!c || c === '??') return `<div class="${cls.join(' ')} back" ${opts.attrs || ''}></div>`;
    const r = c.slice(0, -1), s = c.slice(-1);
    if (s === 'H' || s === 'D') cls.push('red');
    return `<div class="${cls.join(' ')}" data-card="${esc(c)}" ${opts.attrs || ''}><span class="r">${esc(r)}</span><span class="c">${ICON[s] || ''}</span><span class="s">${ICON[s] || ''}</span></div>`;
  }
  const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  // A live countdown: the shell ticks every [data-ends] element once a second.
  const timer = (endsIn) => (endsIn ? `<span class="timer" data-ends="${Date.now() + endsIn}">${mmss(endsIn)}</span>` : '');
  setInterval(() => { for (const el of document.querySelectorAll('[data-ends]')) el.textContent = mmss(Number(el.dataset.ends) - Date.now()); }, 250);
  const board = (rows, val, label = '') => `<div class="board">${rows.map((r, i) => `<div class="row"><span class="n">${i + 1}</span><span>${esc(r.name)}</span><b>${esc(val(r))}${label}</b></div>`).join('')}</div>`;
  const sfx = (n) => { try { window.SFX && window.SFX.play(n); } catch { /* no audio */ } };
  return { games: {}, esc, card, timer, mmss, board, sfx, ICON };
})();
