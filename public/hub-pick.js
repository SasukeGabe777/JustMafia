'use strict';
// "🤔 Pick for us" on the main menu: three quick questions (how many of you, how long, the
// vibe) and the top 3 games with reasons. It reads every tile on the page: data-best (ideal
// crowd), the 👥 range chip, the ⏱ chip and the type chip; locked tiles are left out.
(function () {
  const btn = document.getElementById('pick-us'); if (!btn) return;
  const sfx = (n) => { try { window.SFX && window.SFX.play(n); } catch { /* no audio */ } };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // What each game feels like (unknown games fall back to their type chip).
  const VIBES = {
    president: ['competitive', 'chill'], blanks: ['loud', 'creative'], blackjack: ['chill', 'competitive'], bid: ['competitive', 'loud'], price: ['brainy', 'competitive'],
    emoji: ['creative', 'loud'], truths: ['chill', 'loud'], likely: ['loud', 'chill'], whosaid: ['chill', 'brainy'], spectrum: ['chill', 'brainy'], sketch: ['creative', 'loud'],
    funny: ['loud', 'chill'], plinko: ['chill', 'loud'], trivia: ['brainy', 'competitive'], colormatch: ['chill', 'brainy'], memes: ['creative', 'loud'], letters: ['brainy', 'competitive'],
    summon: ['competitive', 'brainy'], quickdraw: ['creative', 'competitive'], bomb: ['loud', 'competitive'], alien: ['loud', 'brainy'], tune: ['loud', 'competitive'], actout: ['loud', 'creative'],
    debate: ['loud', 'creative'], marble: ['loud', 'chill'], zombie: ['loud', 'chill'], mafia: ['brainy', 'competitive', 'loud'], ducks: ['chill', 'competitive'], kingdoms: ['brainy', 'competitive'],
  };
  const TYPE_VIBES = [[/card|casino|money|auction/, ['competitive', 'chill']], [/guess|trivia|quiz/, ['brainy', 'competitive']], [/bluff|vot|deduc/, ['loud', 'brainy']], [/draw|creative|meme|word|letter|sketch|act/, ['creative', 'loud']], [/battle|strateg/, ['competitive', 'brainy']], [/story|survival/, ['loud', 'chill']]];
  const VIBE_LIST = [['chill', '😌', 'Chill'], ['loud', '📣', 'Loud'], ['brainy', '🧠', 'Brainy'], ['competitive', '🏆', 'Competitive'], ['creative', '🎨', 'Creative']];
  const GROUPS = [[2, '2–3', [2, 3]], [6, '4–8', [4, 8]], [14, '9–20', [9, 20]], [40, '21+', [21, 100]]];
  const TIMES = [[15, '⚡ 15 min'], [30, '⏱ 30 min'], [60, '🌙 An hour+']];
  const ans = { group: 6, time: 30, vibes: new Set(['loud']) };

  const nums = (txt) => { const m = txt && txt.match(/(\d+)\s*[–-]\s*(\d+)/); return m ? [Number(m[1]), Number(m[2])] : null; };
  function info(t) {
    const spans = [...t.querySelectorAll('.meta span')].map((s) => s.textContent);
    const players = nums(spans.find((x) => x.includes('👥'))) || [1, 100];
    const mins = nums(spans.find((x) => x.includes('⏱'))) || [10, 30];
    const type = (spans[2] || spans[spans.length - 1] || '').toLowerCase();
    const key = t.dataset.game, best = t.dataset.best ? t.dataset.best.split('-').map(Number) : null;
    let vibes = VIBES[key]; if (!vibes) { const hit = TYPE_VIBES.find(([re]) => re.test(type)); vibes = hit ? hit[1] : ['chill']; }
    return { t, key, name: (t.querySelector('h2') || {}).textContent || key, icon: (t.querySelector('.icon') || {}).textContent || '🎮', href: t.getAttribute('href'), players, mins, best, vibes, type: spans[2] || '' };
  }
  function recommend() {
    const [, glabel, [lo, hi]] = GROUPS.find((g) => g[0] === ans.group);
    const out = [];
    for (const t of document.querySelectorAll('.tile.live')) {
      if (t.classList.contains('locked')) continue; // locked games stay out until they're unlocked
      const g = info(t), why = [];
      if (g.players[1] < lo || g.players[0] > hi) continue; // the group doesn't fit at all
      let score = 0;
      if (g.best) { const ov = Math.max(0, Math.min(hi, g.best[1]) - Math.max(lo, g.best[0]) + 1) / (hi - lo + 1); if (ov >= 0.5) { score += 4; why.push(`👥 Best with ${g.best[0]}–${g.best[1]}: perfect for ${glabel}`); } else if (ov > 0) { score += 2; why.push(`👥 Works for ${glabel} players`); } else score += 0.5; }
      if (g.mins[0] > ans.time) score -= 4;
      else if (g.mins[1] <= ans.time) { score += 3; why.push(`⏱ ${g.mins[0]}–${g.mins[1]} min: fits your time`); }
      else { score += 1.5; why.push(`⏱ A round fits in ${ans.time === 60 ? 'an hour' : ans.time + ' min'}`); }
      const hits = g.vibes.filter((v) => ans.vibes.has(v));
      if (hits.length) { score += hits.length * 2.5; why.push(`${hits.map((v) => VIBE_LIST.find((x) => x[0] === v)[1]).join('')} ${hits.map((v) => VIBE_LIST.find((x) => x[0] === v)[2].toLowerCase()).join(' & ')}`); }
      else if (ans.vibes.size) score -= 1;
      if (t.closest('.tiles.big') && ans.time >= 30) score += 0.5; // the big games deserve a look on a longer night
      score += Math.random() * 0.4; // a little variety between equal picks
      out.push({ ...g, score, why });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 3);
  }

  let ov = null;
  const close = () => { if (ov) { ov.remove(); ov = null; } };
  function draw(results) {
    if (!ov) { ov = document.createElement('div'); ov.className = 'pick-ov'; document.body.appendChild(ov); ov.addEventListener('click', (e) => { if (e.target === ov) close(); }); }
    const chips = (list, cur, attr) => list.map(([v, l]) => `<button class="pk-chip ${cur(v) ? 'on' : ''}" data-${attr}="${v}">${l}</button>`).join('');
    const quiz = `<div class="pk-q"><h3>1 · How many of you?</h3><div class="pk-row">${chips(GROUPS.map(([v, l]) => [v, '👥 ' + l]), (v) => v === ans.group, 'g')}</div></div>
      <div class="pk-q"><h3>2 · How long have you got?</h3><div class="pk-row">${chips(TIMES, (v) => v === ans.time, 't')}</div></div>
      <div class="pk-q"><h3>3 · What’s the vibe? <small>pick any</small></h3><div class="pk-row">${chips(VIBE_LIST.map(([v, i, l]) => [v, i + ' ' + l]), (v) => ans.vibes.has(v), 'v')}</div></div>`;
    const res = results ? (results.length ? `<div class="pk-res">${results.map((g, i) => `<div class="pk-card" style="--j:${i}"><span class="pk-rank">${['🥇', '🥈', '🥉'][i]}</span><span class="pk-icon">${esc(g.icon)}</span><div class="pk-info"><b>${esc(g.name)}</b><ul>${g.why.slice(0, 3).map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div><a class="pk-play" href="${esc(g.href)}" data-play="${esc(g.key)}">Play ▶</a></div>`).join('')}</div>` : '<p class="pk-none">Nothing fits that just right. Try another group size or time.</p>') : '';
    ov.innerHTML = `<div class="pick-box" role="dialog" aria-label="Pick for us"><button class="pk-x" data-x aria-label="Close">✕</button>
      <h2>🤔 Pick for us</h2><p class="pk-sub">Three quick questions and we’ll pick three games.</p>
      ${results ? `<div class="pk-sum">👥 ${GROUPS.find((g) => g[0] === ans.group)[1]} · ${TIMES.find((t) => t[0] === ans.time)[1]} · ${[...ans.vibes].map((v) => VIBE_LIST.find((x) => x[0] === v)[1]).join('') || 'any vibe'} <button class="pk-link" data-redo>Change answers</button></div>${res}<div class="pk-btns"><button class="pk-go ghost" data-again>🎲 Shuffle picks</button></div>`
        : `${quiz}<div class="pk-btns"><button class="pk-go" data-show>✨ Show us 3 games</button></div>`}</div>`;
    ov.querySelector('[data-x]').onclick = close;
    for (const b of ov.querySelectorAll('[data-g]')) b.onclick = () => { ans.group = Number(b.dataset.g); sfx('pop'); draw(null); };
    for (const b of ov.querySelectorAll('[data-t]')) b.onclick = () => { ans.time = Number(b.dataset.t); sfx('pop'); draw(null); };
    for (const b of ov.querySelectorAll('[data-v]')) b.onclick = () => { const v = b.dataset.v; if (ans.vibes.has(v)) ans.vibes.delete(v); else ans.vibes.add(v); sfx('pop'); draw(null); };
    const sh = ov.querySelector('[data-show]'); if (sh) sh.onclick = () => { sfx('shuffle'); draw(recommend()); };
    const ag = ov.querySelector('[data-again]'); if (ag) ag.onclick = () => { sfx('shuffle'); draw(recommend()); };
    const rd = ov.querySelector('[data-redo]'); if (rd) rd.onclick = () => draw(null);
    for (const a of ov.querySelectorAll('[data-play]')) a.onclick = (e) => { e.preventDefault(); sfx('start'); try { localStorage.setItem('box.recent', a.dataset.play); } catch { /* private */ } setTimeout(() => { location.href = a.getAttribute('href'); }, 250); };
    const first = ov.querySelector('.pk-chip.on, .pk-play, .pk-go'); if (first) first.focus({ preventScroll: true });
  }
  btn.addEventListener('click', (e) => { e.stopPropagation(); sfx('pop'); draw(null); });
  // Arrow keys / Enter on the menu belong to the tiles; inside the wizard they stay here.
  document.addEventListener('keydown', (e) => { if (!ov) return; if (e.key === 'Escape') { close(); e.stopImmediatePropagation(); return; } if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Enter', ' '].includes(e.key)) e.stopImmediatePropagation(); }, true);
  window.PICK_FOR_US = { recommend, answers: ans };
})();
