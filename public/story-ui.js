(function () {
  const drafts = {};
  window.MT_STORY_UI = function (v, socket, body, { esc, paint, reply, votingHtml }) {
    if (v.isJudge || v.you.spectator) return;
    const name = (id) => (v.players.find((p) => p.id === id) || {}).name || '?';
    const emit = (event, data) => socket.emit('player:' + event, data, reply);
    const options = (ids) => ids.map((id) => `<option value="${esc(id)}">${esc(name(id))}</option>`).join('');
    function card(html, first = false) { const el = document.createElement('section'); el.className = 'card story-controls'; el.innerHTML = html; first ? body.prepend(el) : body.appendChild(el); return el; }
    const statuses = v.statuses || [];
    if (statuses.length) card(statuses.map((s) => `<strong class="status-banner">${esc(s.label || s.type)}</strong>`).join(''), true);
    if (v.startingInfo) card(`<details><summary>Private starting clue</summary><p>${esc(v.startingInfo.text)}</p><p>${v.startingInfo.players.map((p) => esc(p.name)).join(' · ')}</p></details>`);
    if (v.nomination) {
      const n = v.nomination, title = v.phase === 'defense' ? name(n.targetId) + ', defend yourself' : name(n.accuserId) + ' is accusing ' + name(n.targetId);
      const el = card(`<h2>${esc(title)}</h2><p>${n.state === 'pending' ? n.seconds + '/' + n.required + ' seconds of this nomination received.' : v.phase === 'voting' ? 'Vote for the accused, or choose no elimination.' : 'Give the speaker the floor.'}</p>${n.state === 'pending' && v.you.alive ? '<button class="btn" data-second>Second nomination</button>' : ''}`, true);
      const b = el.querySelector('[data-second]'); if (b) b.onclick = () => emit('nominate', { second: true });
    }
    if (v.emergency) card('<h3>Emergency town vote</h3><p>The interrupted night resumes after this vote. Your pending night choices are preserved.</p>', true);
    if (v.shortenedDiscussion && v.phase === 'discussion') card(`<h3>The clock has shortened</h3><p>This discussion lasts ${v.shortenedDiscussion} seconds.</p>`, true);
    // Town talk: what the bots (and claims) are saying today, one tidy collapsed line.
    const talk = ['morning', 'discussion', 'voting'].includes(v.phase) ? (v.accusations || []).filter((a) => a.day == null || a.day === v.day).slice(-8) : [];
    if (talk.length) {
      const line = (a) => `<li class="talk-${a.kind}"><b>${esc(name(a.fromId))}:</b> ${esc(a.text)}</li>`, lastA = talk[talk.length - 1];
      const el = card(`<details class="town-talk"${drafts.talkOpen ? ' open' : ''}><summary>💬 <b>${esc(name(lastA.fromId))}:</b> ${esc(lastA.text)}</summary><ul>${talk.slice(0, -1).reverse().map(line).join('')}</ul></details>`);
      const d = el.querySelector('details'); d.addEventListener('toggle', () => { drafts.talkOpen = d.open; });
    }
    const mafia = v.mafia;
    if (mafia) {
      // At night this is the main event; by day it folds into a small "Mafia notes" at the bottom.
      const wrap = (html) => (mafia.canVote ? `<h3>Mafia coordination</h3>${html}` : `<details><summary><b>🔪 Mafia notes</b> <span class="small muted">(only your team sees this)</span></summary>${html}</details>`);
      const el = card(wrap(`${(mafia.rolesInGame || []).length ? `<div class="mafia-roles"><p><b>Roles in this game</b></p><p>${mafia.rolesInGame.map((r) => `<span class="tag team-${r.team}">${MT_ROLES.ROLES[r.role].emoji} ${esc(window.MT_THEMES ? MT_THEMES.roleName(v.theme, r.role, MT_ROLES.ROLES[r.role].name) : MT_ROLES.ROLES[r.role].name)}${r.count > 1 ? ' ×' + r.count : ''}</span>`).join(' ')}</p><p class="small">Town roles to hunt: ${mafia.rolesInGame.filter((r) => r.team === 'town' && r.role !== 'villager').map((r) => esc(MT_ROLES.ROLES[r.role].name)).join(', ') || 'none, just Villagers'}.</p></div>` : ''}${(mafia.intel || []).length ? `<div class="mafia-intel"><p><b>🏹 Hunter intel</b></p><ul>${mafia.intel.map((i) => `<li>Night ${i.night}: <b>${esc(i.name)}</b> is the ${esc(MT_ROLES.ROLES[i.role] ? (window.MT_THEMES ? MT_THEMES.roleName(v.theme, i.role, MT_ROLES.ROLES[i.role].name) : MT_ROLES.ROLES[i.role].name) : i.role)} <span class="small muted">(${esc(i.by)})</span></li>`).join('')}</ul></div>` : ''}${mafia.compelled ? '<p class="status-banner">⚠ Something has taken hold of your kill vote tonight. It cannot change.</p>' : ''}${mafia.canVote ? `<p class="small">Pick tonight's target together. Most votes wins${mafia.decision === 'legacy' ? ' (the Godfather has the final say)' : `; the Godfather breaks a tie, otherwise ${mafia.ties === 'random' ? 'it is decided at random' : 'a tie means no kill'}`}.</p><div class="grid">${mafia.targets.map((id) => `<button class="target ${id === mafia.choice ? 'sel' : ''}" data-mafia="${id}"><canvas data-mafia-av="${id}"></canvas><b>${esc(name(id))}</b>${mafia.totals[id] ? `<small class="picks">🔪 ${mafia.totals[id]}</small>` : ''}</button>`).join('')}</div><ul>${mafia.picks.map((p) => `<li>${esc(name(p.id))} → ${esc(name(p.targetId))}</li>`).join('')}</ul><details class="mafia-signals"${drafts.signalsOpen ? ' open' : ''}><summary>💬 Send your team a quick signal (${mafia.messagesLeft} left)</summary><label>About<select data-tactical-target>${options(mafia.targets)}</select></label><div class="btns">${Object.entries(mafia.tactics).map(([id, text]) => `<button class="btn ghost small" data-tactic="${id}" ${mafia.messagesLeft ? '' : 'disabled'}>${esc(text.replace('{player}', 'this player'))}</button>`).join('')}</div></details>` : ''}<ul>${mafia.messages.slice(-6).map((m) => `<li>${esc(name(m.fromId))}: ${esc(m.text)}</li>`).join('')}</ul>`), mafia.canVote);
      el.querySelectorAll('[data-mafia]').forEach((b) => b.onclick = () => emit('mafiaVote', { targetId: b.dataset.mafia }));
      const sig = el.querySelector('.mafia-signals'); if (sig) sig.ontoggle = () => { drafts.signalsOpen = sig.open; };
      el.querySelectorAll('[data-mafia-av]').forEach((cv) => { const p = v.players.find((p) => p.id === cv.dataset.mafiaAv); paint(cv, p.avatar); });
      el.querySelectorAll('[data-tactic]').forEach((b) => b.onclick = () => emit('mafiaMessage', { tactic: b.dataset.tactic, targetId: el.querySelector('[data-tactical-target]').value }));
    }
    const special = v.special;
    if (special && special.canAct && (special.variants.length > 1 || special.bomb || special.mimic || special.interrupt)) {
      const roles = MT_ROLES.ROLES;
      const el = card(`<h3>Ability controls</h3>${special.variants.length > 1 ? `<label>Choose ability<select data-variant>${special.variants.map((a) => `<option value="${a.id}" ${a.id === special.variant || special.variant === 'primary' && a.id === 'midas' ? 'selected' : ''}>${esc(a.label)}</option>`).join('')}</select></label>` : '<p class="small">Choose a target above if your role has an available action.</p>'}${special.bomb ? `<label>Fuse delay (phase transitions)<input id="bomb-delay" type="number" min="${special.bomb.min}" max="${special.bomb.max}" value="${drafts.bombDelay || special.bomb.min}"></label><small>Detonation waits for a daytime phase.</small>` : ''}${special.mimic ? `<label>Copy one active ability<select data-copy>${special.eligibleCopies.map((r) => `<option value="${r}">${esc(roles[r].name)}</option>`).join('')}</select></label><button class="btn" data-mimic>Assume this ability (once)</button>` : ''}${special.interrupt ? '<button class="btn danger" data-interrupt>Town Square Interruption</button>' : ''}`);
      const variant = el.querySelector('[data-variant]'); if (variant) variant.onchange = () => emit('variant', { variant: variant.value });
      const delay = el.querySelector('#bomb-delay'); if (delay) delay.oninput = () => { drafts.bombDelay = delay.value; };
      const mimic = el.querySelector('[data-mimic]'); if (mimic) mimic.onclick = () => emit('special', { op: 'mimic', role: el.querySelector('[data-copy]').value });
      const interrupt = el.querySelector('[data-interrupt]'); if (interrupt) interrupt.onclick = () => emit('special', { op: 'interrupt' });
    }
    // DLC 1: the Eavesdropper's overheard Mafia talk, the Town Crier's proclamation, Cupid's bond.
    if (v.eavesdrop) card(`<h3>👂 Overheard tonight</h3>${v.eavesdrop.length ? `<ul>${v.eavesdrop.map((t) => `<li>“${esc(t)}”</li>`).join('')}</ul>` : '<p class="small muted">Nothing yet. The Mafia talk at night.</p>'}<p class="small muted">You hear what they say, never who says it.</p>`);
    if (v.crier) {
      const el = card(`<h3>📯 Town Crier</h3>${v.crier.canUse ? `<p class="small">Once a day, an anonymous proclamation on the big screen.</p><label>About<select data-crier-target>${options(v.crier.targets)}</select></label><div class="btns">${v.crier.words.map((w) => `<button class="btn small" data-crier-word="${esc(w)}">${esc(w)}</button>`).join('')}</div>` : `<p class="small muted">${v.crier.used ? 'You already proclaimed today.' : 'You can proclaim during the discussion.'}</p>`}`);
      el.querySelectorAll('[data-crier-word]').forEach((b) => b.onclick = () => emit('ability', { op: 'crier', targetId: el.querySelector('[data-crier-target]').value, word: b.dataset.crierWord }));
    }
    if (v.lover) card(`<h3>💘 Bound to ${esc(v.lover.name)}</h3><p class="small">${v.lover.alive ? 'If either of you dies, the other dies of a broken heart.' : 'Your bond is broken.'}</p>`);
    // The Headhunter: level, mark, and the powers they've unlocked (the server checks everything).
    const hh = v.headhunter;
    if (hh) {
      const L = hh.levels, next = L[Math.min(6, hh.level + 1)], roleName = (k) => (MT_ROLES.ROLES[k] ? (window.MT_THEMES ? MT_THEMES.roleName(v.theme, k, MT_ROLES.ROLES[k].name) : MT_ROLES.ROLES[k].name) : k);
      const target = `<label>Target<select data-hh-target>${options(hh.targets)}</select></label>`;
      const btn = (op, label, cls = '') => `<button class="btn small ${cls}" data-hh="${op}">${label}</button>`;
      const el = card(`<h3>🎯 Headhunter · Level ${hh.level}</h3>
        <div class="hh-levels">${[1, 2, 3, 4, 5, 6].map((n) => `<span class="hh-pip${hh.level >= n ? ' on' : ''}" title="${esc(L[n].title)}">${n}</span>`).join('')}</div>
        <p class="small">${hh.level < 6 ? `Next level: <b>${esc(next.title)}</b>. ${esc(next.text)}` : 'Maximum level.'}</p>
        <p><b>Your mark:</b> ${hh.mark ? esc(name(hh.mark)) : 'nobody yet'}${v.phase === 'night' ? ' <span class="small muted">(tap someone above to mark them)</span>' : ''}</p>
        ${hh.targets.length && (v.phase !== 'night' || hh.canPuppet || hh.canReveal || hh.canStrike) ? target : ''}
        <div class="btns">${v.phase !== 'night' ? btn('mark', '🎯 Mark') : ''}${hh.canPuppet ? btn('puppet', '🧵 Force a Mafia vote') : ''}${hh.canReveal ? btn('reveal', '👁 Learn their role') : ''}${hh.canStrike ? btn('strike', '⚡ Strike (once)', 'danger') : ''}${hh.canExecute ? btn('execute', '⚖ Execute (today)', 'danger') : ''}</div>
        ${hh.canDisguise ? `<label>Investigators see you as<select data-hh-role><option value="">Villager</option>${hh.disguises.filter((k) => k !== 'villager').map((k) => `<option value="${k}"${hh.disguise === k ? ' selected' : ''}>${esc(roleName(k))}</option>`).join('')}</select></label>` : ''}
        ${hh.roles ? `<details><summary>👁 Everyone’s role</summary><ul>${hh.roles.map((r) => `<li>${esc(r.name)}: ${esc(roleName(r.role))}${r.alive ? '' : ' 👻'}</li>`).join('')}</ul></details>` : ''}`);
      const sel = el.querySelector('[data-hh-target]');
      if (sel) { if (hh.targets.includes(drafts.hhTarget)) sel.value = drafts.hhTarget; else if (hh.mark && hh.targets.includes(hh.mark)) sel.value = hh.mark; sel.onchange = () => { drafts.hhTarget = sel.value; }; }
      el.querySelectorAll('[data-hh]').forEach((b) => b.onclick = () => {
        const op = b.dataset.hh, t = sel && sel.value;
        if (op === 'strike' && !confirm(`Strike ${name(t)} down now? You only get one.`)) return;
        if (op === 'execute' && !confirm(`Execute ${name(t)} now?`)) return;
        emit('headhunter', { op, targetId: t });
      });
      const role = el.querySelector('[data-hh-role]'); if (role) role.onchange = () => emit('headhunter', { op: 'disguise', role: role.value || null });
    }
    // The Crafter's workshop: search, an inventory of materials, the recipe book, and tools.
    const cr = v.crafter, K = window.MT_CRAFTING;
    if (cr && K) {
      const mats = Object.entries(K.MATERIALS), last = cr.finds[cr.finds.length - 1];
      const fresh = last && drafts.crSeen !== `${last.day}-${last.night}-${cr.finds.length}`;
      const slot = ([id, m]) => `<div class="craft-slot${(cr.materials[id] || 0) ? '' : ' empty'}${fresh && last.material === id ? ' new' : ''}" title="${esc(m.name)}"><span class="cs-icon">${m.icon}</span><b>${cr.materials[id] || 0}</b><small>${esc(m.name)}</small></div>`;
      const need = (r) => Object.entries(r.needs).map(([id, n]) => `<span class="need${(cr.materials[id] || 0) >= n ? ' ok' : ''}">${K.MATERIALS[id].icon}×${n}</span>`).join('');
      const recipe = ({ id, canCraft }) => { const r = K.RECIPES[id]; return `<div class="recipe${canCraft ? ' can' : ''}"><span class="r-icon">${r.icon}</span><div class="r-body"><b>${esc(r.name)}</b> <span class="small muted">${r.when === 'night' ? '🌙 night' : '☀️ day'}</span><p class="small">${esc(r.text)}</p><div class="needs">${need(r)}</div></div><button class="btn small" data-craft="${id}" ${canCraft ? '' : 'disabled'}>Craft</button></div>`; };
      const owned = Object.entries(cr.tools).filter(([, n]) => n > 0);
      const toolRow = ([id, n]) => {
        const r = K.RECIPES[id], ready = cr.ready.includes(id), armed = cr.armed === id;
        const pick = r.target === 'others' && ready && !armed ? `<select data-tool-target="${id}">${options(cr.targets)}</select>` : '';
        const action = armed ? `<span class="armed">✓ Using tonight${cr.armedTarget && cr.armedTarget !== v.you.id ? ' on ' + esc(name(cr.armedTarget)) : ''}</span><button class="btn small ghost" data-disarm>Cancel</button>`
          : ready ? `<button class="btn small" data-use="${id}">${r.when === 'day' ? 'Strike' : 'Use tonight'}</button>` : `<span class="small muted">${r.when === 'night' ? 'Usable at night' : 'Usable in the day'}</span>`;
        return `<div class="tool${armed ? ' on' : ''}"><span class="t-icon">${r.icon}</span><b>${esc(r.name)} ×${n}</b>${pick}${action}</div>`;
      };
      const el = card(`<div class="workshop"><h3>🔨 Crafter’s Workshop</h3>
        <button class="btn search-btn" data-search ${cr.canSearch ? '' : 'disabled'}>🔎 ${cr.canSearch ? `Search for materials (${cr.searchWhen})` : `Searched ${cr.searchWhen}`}</button>
        ${fresh ? `<p class="found-pop">You found <b>${K.MATERIALS[last.material].icon} ${esc(K.MATERIALS[last.material].name)}</b>!</p>` : ''}
        <h4>🎒 Materials</h4><div class="craft-inv">${mats.map(slot).join('')}</div>
        ${owned.length ? `<h4>🧰 Your tools</h4><div class="tools">${owned.map(toolRow).join('')}</div>` : ''}
        <details class="recipe-book"${drafts.crBook === false ? '' : ' open'}><summary>📖 Recipe book</summary>${cr.recipes.map(recipe).join('')}</details></div>`);
      if (fresh) setTimeout(() => { drafts.crSeen = `${last.day}-${last.night}-${cr.finds.length}`; }, 2500);
      const book = el.querySelector('.recipe-book'); if (book) book.addEventListener('toggle', () => { drafts.crBook = book.open; });
      const s = el.querySelector('[data-search]'); if (s) s.onclick = () => emit('crafter', { op: 'search' });
      el.querySelectorAll('[data-craft]').forEach((b) => b.onclick = () => emit('crafter', { op: 'craft', recipe: b.dataset.craft }));
      el.querySelectorAll('[data-tool-target]').forEach((sel) => { const keep = drafts['crT' + sel.dataset.toolTarget]; if (keep && cr.targets.includes(keep)) sel.value = keep; sel.onchange = () => { drafts['crT' + sel.dataset.toolTarget] = sel.value; }; });
      el.querySelectorAll('[data-use]').forEach((b) => b.onclick = () => {
        const tool = b.dataset.use, r = K.RECIPES[tool], sel = el.querySelector(`[data-tool-target="${tool}"]`), t = sel && sel.value;
        if (r.when === 'day' && !confirm(`Strike ${name(t)} down with your sword? Nobody will know it was you.`)) return;
        emit('crafter', { op: 'use', tool, targetId: t || null });
      });
      const d = el.querySelector('[data-disarm]'); if (d) d.onclick = () => emit('crafter', { op: 'disarm' });
    }
    if (v.ghost && (v.ghost.voteEnabled || v.ghost.chatEnabled)) { // nothing to show when both are off
      const g = v.ghost, el = card(`<h3>Ghost powers</h3>${g.voteEnabled ? `<p><b>Ghost vote: ${g.voteUsed ? 'used' : 'ready'}</b></p><p class="small">You get one vote from beyond, once per game.</p>` : ''}${g.chatEnabled ? `<h4>Ghost chat</h4><p class="small">Only ghosts and the Judge see this channel.</p><ul>${g.messages.slice(-12).map((m) => `<li>${esc(m.name)}: ${esc(m.text)}</li>`).join('')}</ul><input data-draft="ghost" maxlength="160" aria-label="Ghost message"><button class="btn" data-ghost-send>Send to ghosts</button>` : ''}`);
      const send = el.querySelector('[data-ghost-send]'); if (send) send.onclick = () => { emit('ghostChat', { text: el.querySelector('input').value }); drafts.ghost = ''; };
      if (v.phase === 'voting' && v.voting) { const vote = card(votingHtml()); vote.querySelectorAll('[data-vote]').forEach((b) => b.onclick = () => emit('vote', { targetId: b.dataset.vote })); vote.querySelectorAll('[data-av]').forEach((cv) => { const p = v.players.find((p) => p.id === cv.dataset.av); if (p) paint(cv, p.avatar); }); }
    }
    const social = v.social;
    if (social) {
      const living = v.players.filter((p) => p.alive && p.id !== v.you.id && !p.spectator).map((p) => p.id);
      if (social.canWhisper || social.canNominate) {
        const el = card(`<h3>Discussion actions</h3><select data-social-target aria-label="Choose player">${options(living)}</select>${social.canWhisper ? `<button class="btn ghost" data-whisper-request ${social.whispersLeft ? '' : 'disabled'}>Request private whisper (${social.whispersLeft} left)</button><p class="small">Recipient must accept. Three short messages each over 30 seconds. ${social.judgeReadsWhispers ? 'The Judge can read content in this setup.' : 'The Judge sees usage metadata only.'}</p>` : ''}${social.canNominate ? '<button class="btn" data-nominate>Nominate</button>' : ''}`);
        const request = el.querySelector('[data-whisper-request]'); if (request) request.onclick = () => emit('whisper', { op: 'request', targetId: el.querySelector('select').value });
        const nominate = el.querySelector('[data-nominate]'); if (nominate) nominate.onclick = () => emit('nominate', { targetId: el.querySelector('select').value });
      }
      for (const h of social.sessions.filter((h) => ['pending', 'active'].includes(h.state))) {
        const other = h.fromId === v.you.id ? h.toId : h.fromId;
        const el = card(`<h3>Whisper with ${esc(name(other))}</h3>${h.state === 'pending' ? h.toId === v.you.id ? '<button class="btn" data-accept>Accept</button><button class="btn ghost" data-decline>Decline</button>' : '<p>Waiting for consent…</p>' : `<p class="small">Private session closes automatically after 30 seconds.</p><ul>${h.messages.map((m) => `<li>${esc(name(m.fromId))}: ${esc(m.text)}</li>`).join('')}</ul><input data-draft="whisper-${h.id}" maxlength="320" aria-label="Private whisper"><button class="btn" data-whisper-send>Send privately</button>`}`);
        for (const [selector, accept] of [['[data-accept]', true], ['[data-decline]', false]]) { const b = el.querySelector(selector); if (b) b.onclick = () => emit('whisper', { op: 'reply', id: h.id, accept }); }
        const send = el.querySelector('[data-whisper-send]'); if (send) send.onclick = () => { emit('whisper', { op: 'send', id: h.id, text: el.querySelector('input').value }); drafts['whisper-' + h.id] = ''; };
      }
    }
    body.querySelectorAll('[data-draft]').forEach((el) => { el.value = drafts[el.dataset.draft] || ''; el.oninput = () => { drafts[el.dataset.draft] = el.value; }; });
    if (v.progression && v.phase === 'gameover') card(`<h3>Your profile</h3><p>${v.progression.coins} coins · ${v.progression.stats.games} completed games</p><p>${esc(v.progressionNotice || '')}</p><p class="small">${esc(v.progression.storage)}</p>`);
  };
})();
