(function () {
  const C = window.MT_CONFIG, O = window.MT_OPTIONS, R = window.MT_ROLES;
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  let query = '', filter = 'all', selectedRole = 'detective', current, action;
  const GLOBAL = {
    storytellerMode:['Storyteller', ['classic','assisted','human']], misinformation:['Information corruption', ['invert','plausible','judge','assisted']], assistance:['Assistance strength', ['gentle','dramatic']],
    mafiaDecision:['Mafia decision rule', ['plurality','legacy']], mafiaTie:['Mafia tie without Godfather', ['none','random']], mafiaExtraKills:['Extra Mafia kills (opt in)',0,2], mafiaBluffs:['Unused Town cover identities',0,3],
    ghostVotes:['One ghost ballot per game'], ghostChat:['Ghost chat (+ Judge)'], whispers:['Consent-based private whispers'], whispersPerDay:['Whisper requests per day',0,10], whisperLength:['Whisper message length',20,240], whisperTeam:['Who may initiate whispers',['any','townOnly','mafiaOnly']], judgeReadsWhispers:['Judge may read private whisper content'],
    votingMode:['Voting flow',['classic','nomination']], accusationSeconds:['Accusation seconds',5,120], defenseSeconds:['Defense seconds',5,120], nominationsPerDay:['Nominations per player',1,5], nominationCooldown:['Nomination cooldown',0,120], nominationSecondsRequired:['Required seconders',0,10], nominationSeconds:['Seconding timeout',5,120], repeatNominations:['Allow repeated nominations'], nominationEndsDiscussion:['Nomination ends discussion'],
  };
  function field(k, label, value, d, attr) {
    const attributes = attr + '="' + k + '"';
    if (d.choices) return `<label>${esc(label)}<select ${attributes}>${d.choices.map((v) => `<option value="${v}" ${value === v ? 'selected' : ''}>${esc(O.label(v))}</option>`).join('')}</select></label>`;
    if (d.type === 'boolean') return `<label class="check"><input type="checkbox" ${attributes} ${value ? 'checked' : ''}> ${esc(label)}</label>`;
    return `<label>${esc(label)}<input type="number" ${attributes} min="${d.min}" max="${d.max}" step="${d.step || 1}" value="${value}"></label>`;
  }
  const valueOf = (el) => el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value;
  function configRole() {
    const box = document.getElementById('role-options'), cfg = C.normalize(selectedRole, current.settings.roleConfig[selectedRole]);
    box.innerHTML = `<h3>${esc(R.ROLES[selectedRole].name)}</h3><label>Configuration<select id="role-mode"><option value="standard" ${cfg.mode === 'standard' ? 'selected' : ''}>Standard</option><option value="custom" ${cfg.mode === 'custom' ? 'selected' : ''}>Custom</option></select></label>${cfg.mode === 'custom' ? `<div class="advanced-fields">${Object.keys(cfg).filter((k) => C.FIELDS[k]).map((k) => field(k, C.FIELDS[k].label, cfg[k], C.FIELDS[k], 'data-role-option')).join('')}</div>` : '<p>Recommended defaults. Switch to Custom to edit.</p>'}<button class="btn ghost" id="role-standard">Reset role to Standard</button>`;
    box.querySelectorAll('input,select,button').forEach((el) => { el.disabled = current.phase !== 'lobby'; });
    const update = (next) => { const config = { ...C.normalize(selectedRole,current.settings.roleConfig[selectedRole]),...next }; current.settings.roleConfig[selectedRole] = config; action('settings',{ settings:{ roleConfig:{ ...current.settings.roleConfig } } }); };
    box.querySelector('#role-mode').onchange = (e) => { const mode = e.target.value; e.target.blur(); update({ mode }); };
    box.querySelector('#role-standard').onclick = () => action('resetRoleConfig', { role:selectedRole });
    box.querySelectorAll('[data-role-option]').forEach((el) => el.onchange = () => { const value = valueOf(el); el.blur(); update({ [el.dataset.roleOption]:value }); });
  }
  function setup(st, act) {
    current = st; action = act; let root = document.getElementById('story-setup');
    if (!root) {
      root = document.createElement('div'); root.id = 'story-setup'; root.className = 'card';
      root.innerHTML = '<h3>Storyteller &amp; role options</h3><p class="small muted">Optional advanced mechanics. Narration presents public events and never controls game truth.</p><details><summary>Team coordination, ghosts, whispers and voting</summary><div class="advanced-fields" id="global-rule-options"></div></details><details id="role-config-details"><summary>Configure an individual role</summary><select id="config-role" aria-label="Configure role"></select><div id="role-options"></div></details><button class="btn ghost" id="reset-all-rules">Reset all settings</button>';
      document.querySelector('main[data-panel="setup"]').appendChild(root);
      const select = root.querySelector('#config-role'); select.innerHTML = R.ROLE_ORDER.map((r) => `<option value="${r}">${esc(R.ROLES[r].name)}</option>`).join(''); select.value = selectedRole;
      select.onchange = () => { selectedRole = select.value; configRole(); };
      root.querySelector('#reset-all-rules').onclick = () => act('resetAllSettings');
      document.querySelectorAll('#s-roles .role').forEach((row) => { const role = row.querySelector('[data-role]').dataset.role, b = document.createElement('button'); b.className = 'btn small ghost'; b.textContent = 'Configure'; b.onclick = () => { selectedRole = role; select.value = role; root.querySelector('#role-config-details').open = true; configRole(); root.scrollIntoView({ behavior:'smooth', block:'start' }); }; row.appendChild(b); });
    }
    if (root.contains(document.activeElement) && ['INPUT','SELECT'].includes(document.activeElement.tagName)) return;
    const globals = root.querySelector('#global-rule-options');
    globals.innerHTML = Object.entries(GLOBAL).map(([k,[label,choices,max]]) => field(k,label,st.settings[k],Array.isArray(choices) ? { choices } : choices == null ? { type:'boolean' } : { type:'number',min:choices,max },'data-global-option')).join('');
    globals.querySelectorAll('[data-global-option]').forEach((el) => { el.disabled = st.phase !== 'lobby'; el.onchange = () => { const value = valueOf(el); el.blur(); act('settings',{ settings:{ [el.dataset.globalOption]:value } }); }; });
    root.querySelector('#reset-all-rules').disabled = st.phase !== 'lobby'; configRole();
  }
  function render(st, act) {
    current = st; action = act; const root = document.getElementById('grimoire');
    if (root.dataset.ready && root.contains(document.activeElement) && document.activeElement.closest('#gr-players') && ['INPUT','SELECT'].includes(document.activeElement.tagName)) return;
    const name = (id) => (st.allPlayers.find((p) => p.id === id) || {}).name || id || '—';
    if (!root.dataset.ready) {
      root.innerHTML = '<div class="card"><h2>Private Grimoire</h2><p>Server truth. Keep this screen private.</p><div class="row"><input id="gr-search" placeholder="Search name, role or status" aria-label="Search Grimoire"><select id="gr-filter"><option value="all">Everyone</option><option value="alive">Living</option><option value="dead">Ghosts</option><option value="mafia">Mafia</option><option value="town">Town</option><option value="neutral">Neutral</option></select></div></div><div class="gr-grid" id="gr-players"></div><div class="card" id="gr-order"></div><div class="card" id="gr-effects"></div><div class="card"><h3>Chronological secret log</h3><p class="small">Newest 600 entries. True and delivered information remain separately auditable.</p><div id="gr-events"></div></div>';
      root.dataset.ready = '1'; root.querySelector('#gr-search').oninput = (e) => { query = e.target.value.toLowerCase(); render(current,action); }; root.querySelector('#gr-filter').onchange = (e) => { filter = e.target.value; render(current,action); };
    }
    const json = (v) => esc(JSON.stringify(v,(k,value) => ['actorId','targetId','source','fromId'].includes(k) ? name(value) : value,2));
    const players = st.allPlayers.filter((p) => (filter === 'all' || filter === 'alive' && p.alive || filter === 'dead' && !p.alive || filter === p.team) && JSON.stringify([p.name,p.role,p.statuses]).toLowerCase().includes(query));
    const picks = st.mafiaCoordination.picks;
    root.querySelector('#gr-players').innerHTML = players.map((p) => `<article class="card gr-player"><canvas data-gr-avatar="${p.id}"></canvas><h3>${esc(p.name)} · ${p.alive ? 'Alive' : 'Ghost'}</h3><b>${esc((R.ROLES[p.role] || {}).name || 'Undealt')} · ${esc(p.team)}</b><p>${p.statuses.map((s) => `<span class="tag">${esc(C.STATUS[s.type].label)} · expires ${s.expiresTurn == null ? 'day ' + (s.expiresDay || '∞') : 'turn ' + s.expiresTurn}</span>`).join(' ') || 'No active statuses'}</p><dl><dt>Ability uses</dt><dd>${esc(JSON.stringify(p.actionUses))}</dd><dt>Target / Mafia vote</dt><dd>${esc(name(p.action))} / ${esc(name((picks.find((x) => x.id === p.id) || {}).targetId))}</dd><dt>Ghost ballot / whispers</dt><dd>${p.ghostVoteUsed ? 'Used' : 'Available if enabled'} / ${p.whispersUsed} requests</dd><dt>Copied / stolen</dt><dd>${esc([p.copiedAbility,...p.stolenAbilities].filter(Boolean).map((a) => a.role + ': ' + (a.remaining == null ? 'unlimited' : a.remaining) + ' uses').join('; ') || '—')}</dd><dt>Scheduled at home</dt><dd>${esc(st.scheduledEvents.filter((e) => e.targetId === p.id && !e.resolved).map((e) => e.type + ' at turn ' + e.triggerTurn).join('; ') || '—')}</dd></dl><details><summary>Storyteller intervention</summary><select data-status-for="${p.id}" aria-label="Status">${Object.entries(C.STATUS).map(([s,d]) => `<option value="${s}">${esc(d.label)}</option>`).join('')}</select><label>Duration in phase transitions<input data-turns-for="${p.id}" type="number" min="1" max="30" value="4"></label><button class="btn small" data-add-status="${p.id}">Apply</button><button class="btn small ghost" data-clear-status="${p.id}">Clear</button><label>Next corrupted result<select data-info-for="${p.id}"><option value="true">Mafia / dangerous</option><option value="false">Innocent / not dangerous</option>${R.ROLE_ORDER.map((r) => `<option value="${r}">${esc(R.ROLES[r].name)}</option>`).join('')}</select></label><button class="btn small ghost" data-info="${p.id}">Set next result (Judge mode)</button></details></article>`).join('');
    root.querySelectorAll('[data-gr-avatar]').forEach((cv) => { const p = st.players.find((p) => p.id === cv.dataset.grAvatar) || {}; cv.width = 100; cv.height = 90; (p.alive ? MTArt.drawCharacter : MTArt.drawGhost)(cv.getContext('2d'),50,82,p.avatar || {},{ scale:1.1, theme:st.theme }); });
    for (const [attr,clear] of [['data-add-status',false],['data-clear-status',true]]) root.querySelectorAll('[' + attr + ']').forEach((b) => b.onclick = () => { const id = b.getAttribute(attr); act('status',{ id,status:root.querySelector('[data-status-for="' + id + '"]').value,turns:Number(root.querySelector('[data-turns-for="' + id + '"]').value),clear }); });
    root.querySelectorAll('[data-info]').forEach((b) => b.onclick = () => { const result = root.querySelector('[data-info-for="' + b.dataset.info + '"]').value; act('misinformation',{ id:b.dataset.info,result:result === 'true' ? true : result === 'false' ? false : result }); });
    const resolution = st.nightResolution;
    root.querySelector('#gr-order').innerHTML = `<h3>Night action order</h3><p>${(resolution ? resolution.order : ['collect','blocks','statuses','protection','specials','teamKill','attacks','information','observations','outcomes']).map((s) => esc(O.label(s))).join(' → ')}</p><p class="small">Blocks resolve simultaneously. Protection precedes attacks. Information resolves before pending deaths are applied at morning. Delayed effects run during daytime phase transitions.</p>${resolution ? '<p>Blocked: ' + resolution.blocked.map(name).map(esc).join(', ') + ' · Protected: ' + resolution.protected.map(name).map(esc).join(', ') + '</p>' : ''}`;
    root.querySelector('#gr-effects').innerHTML = `<h3>Scheduled events &amp; Mafia coordination</h3><pre>${json({ scheduled:st.scheduledEvents, mafia:st.mafiaCoordination })}</pre>`;
    root.querySelector('#gr-events').innerHTML = st.eventLog.map((e) => `<details><summary>D${e.day} · ${esc(e.phase)} · ${esc(e.kind)} ${e.actorId ? '· ' + esc(name(e.actorId)) : ''} ${e.targetId ? '→ ' + esc(name(e.targetId)) : ''}</summary><pre>${json(e)}</pre></details>`).join('');
  }
  window.MT_GRIMOIRE = { setup,render };
})();
