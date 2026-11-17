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
  // Update `el` to match `html` in place: only changed text and attributes are touched, so
  // buttons stay under the finger, animations don't replay and scrolling doesn't jump.
  // Elements marked data-keep keep their own children (e.g. a canvas mounted by script).
  function morph(el, html) {
    const tpl = document.createElement('template'); tpl.innerHTML = html;
    kids(el, tpl.content);
  }
  const same = (a, b) => a.nodeType === b.nodeType && a.nodeName === b.nodeName && (a.nodeType !== 1 || (a.id || '') === (b.id || ''));
  function kids(a, b) {
    if (a.nodeType === 1 && a.hasAttribute('data-keep')) return;
    const want = b.childNodes;
    for (let i = 0; i < want.length; i++) {
      const nb = want[i], na = a.childNodes[i];
      if (!na) a.appendChild(document.importNode(nb, true));
      else if (!same(na, nb)) a.replaceChild(document.importNode(nb, true), na);
      else node(na, nb);
    }
    while (a.childNodes.length > want.length) a.removeChild(a.lastChild);
  }
  function node(a, b) {
    if (a.nodeType !== 1) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return; }
    for (const at of [...a.attributes]) if (!b.hasAttribute(at.name)) a.removeAttribute(at.name);
    for (const at of b.attributes) if (a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value);
    kids(a, b);
    const focused = a === document.activeElement;
    if (a.tagName === 'INPUT' && !focused) { if (a.type === 'checkbox' || a.type === 'radio') a.checked = b.hasAttribute('checked'); else if (a.value !== (b.getAttribute('value') || '')) a.value = b.getAttribute('value') || ''; }
    if (a.tagName === 'SELECT' && !focused) { const o = b.querySelector('option[selected]'); a.value = o ? o.getAttribute('value') : (a.options[0] ? a.options[0].value : ''); }
  }
  // JustMafia is not a box game (its own pages at /mafia), but a box room can switch to it:
  // the room hands everyone over and gets the result back (box/index.js EXTERNAL).
  const games = { mafia: { name: 'JustMafia', icon: '🔪', external: true, href: '/mafia', about: 'Find the killers before they find you. A big-screen murder mystery.', how: ['Everyone gets a secret role on their phone.', 'At night the Mafia picks a victim; by day the town votes someone out.', 'The town wins when the Mafia is gone; the Mafia wins when they match the town.'] } };
  return { games, esc, card, timer, mmss, board, sfx, morph, ICON };
})();
