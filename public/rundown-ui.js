// Renders the after-game "Rundown of the game" (TV and Judge console share this).
// The server builds the story (rules/rundown.js) and only after the game is over.
(function () {
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function html(rd) {
    const cast = (rd.cast || []).map((c) => `<li class="team-${esc(c.team)}${c.alive ? '' : ' dead'}"><b>${esc(c.name)}</b> ${esc(c.role)}${c.won ? ' 🏆' : ''}${c.alive ? '' : ' 👻'}</li>`).join('');
    const awards = (rd.awards || []).map((a) => `<li><span>${a.emoji}</span> <b>${esc(a.label)}</b>: ${esc(a.name)}${a.detail ? ` <small>(${esc(a.detail)})</small>` : ''}</li>`).join('');
    const chapters = (rd.chapters || []).map((ch, i) => `<section class="rd-chapter" style="animation-delay:${Math.min(i, 12) * 0.25}s"><h3>${esc(ch.title)}</h3><ul>${ch.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></section>`).join('');
    return `${awards ? `<section class="rd-awards"><h3>Awards</h3><ul>${awards}</ul></section>` : ''}
      <section class="rd-cast"><h3>Who was who</h3><ul>${cast}</ul></section>
      ${chapters || '<p>No events were recorded.</p>'}`;
  }
  window.MT_RUNDOWN = { html };
})();
