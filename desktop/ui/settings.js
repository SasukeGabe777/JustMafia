'use strict';
// App settings page (desktop app only). Talks to main.js through window.jgb (preload-settings.js).
(function () {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  let st = null;

  function status(text, kind = 'info') {
    const el = $('#status');
    el.hidden = !text; el.textContent = text || ''; el.className = 'status ' + kind;
  }
  function tab(name) {
    if (!$$('.tabs button').some((b) => b.dataset.tab === name)) name = 'phones';
    for (const b of $$('.tabs button')) b.classList.toggle('on', b.dataset.tab === name);
    for (const p of $$('[data-panel]')) p.hidden = p.dataset.panel !== name || (p.id === 'firewall-card' && !!st && st.mode === 'online');
  }
  for (const b of $$('.tabs button')) b.addEventListener('click', () => tab(b.dataset.tab));

  function render() {
    const s = st.settings;
    const online = st.mode === 'online';
    $('#local-join').hidden = online; $('#online-join').hidden = !online;
    $('#join-url').textContent = st.joinUrl || '(the local server is not running)';
    $('#online-join-url').textContent = st.origin ? st.origin + '/join' : '';
    const sel = $('#adapter');
    sel.innerHTML = '';
    const auto = document.createElement('option');
    auto.value = ''; auto.textContent = 'Automatic' + (st.address && !s.adapter ? ` (${st.address})` : '');
    sel.append(auto);
    for (const a of st.adapters) {
      const o = document.createElement('option');
      o.value = a.address; o.textContent = `${a.address} — ${a.name}${a.virtual ? ' (virtual)' : ''}`;
      sel.append(o);
    }
    if (s.adapter && !st.adapters.some((a) => a.address === s.adapter)) {
      const o = document.createElement('option'); o.value = s.adapter; o.textContent = `${s.adapter} (not connected now)`; sel.append(o);
    }
    sel.value = s.adapter;
    for (const r of $$('input[name=mode]')) r.checked = r.value === s.mode;
    $('#online-url').value = s.onlineUrl;
    $('#port').value = s.port;
    $('#fullscreen').checked = s.fullscreen;
    $('#overlay').checked = s.steamOverlay;
    modeFields();
    const steam = st.steam || {};
    const rows = [
      ['Version', st.version + (st.dev ? ' (development)' : '')],
      ['Mode', online ? 'Online: ' + st.origin : 'Local' + (st.port ? ' · port ' + st.port : '')],
      ['Steam', steam.status + (steam.appId ? ` · App ID ${steam.appId}` : '') + (steam.user ? ` · ${steam.user}` : '')],
      ['Saves', st.dataDir], ['My music', st.musicDir], ['Log', st.logFile],
    ];
    const dl = $('#about'); dl.innerHTML = '';
    for (const [k, v] of rows) { const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v || '—'; dl.append(dt, dd); }
    if (st.lastError) status(st.lastError, 'err');
    else if (st.notice) status(st.notice, 'info');
    const cur = $$('.tabs button').find((b) => b.classList.contains('on'));
    if (cur) tab(cur.dataset.tab); // the mode may have changed which cards show
  }
  function modeFields() {
    const online = $$('input[name=mode]').find((r) => r.checked)?.value === 'online';
    $('#url-field').hidden = !online; $('#port-field').hidden = online;
  }
  for (const r of $$('input[name=mode]')) r.addEventListener('change', modeFields);

  function collect() {
    return {
      mode: $$('input[name=mode]').find((r) => r.checked)?.value || 'local',
      onlineUrl: $('#online-url').value.trim(),
      adapter: $('#adapter').value,
      port: Number($('#port').value) || st.settings.port,
      fullscreen: $('#fullscreen').checked,
      steamOverlay: $('#overlay').checked,
    };
  }
  const busy = (on) => { for (const b of $$('button')) b.disabled = on; };

  $('#test-url').addEventListener('click', async () => {
    busy(true); status('Testing… (a sleeping free server can take up to a minute to wake up)', 'info');
    const r = await window.jgb.testUrl($('#online-url').value);
    busy(false);
    if (r && r.ok) { $('#online-url').value = r.url; status(`✅ ${r.url} is a working JustGameBox server. Press Save to use it.`, 'ok'); } else status(r ? r.error : 'Test failed.', 'err');
  });
  $('#save').addEventListener('click', async () => {
    const patch = collect();
    busy(true); status(patch.mode === 'online' ? 'Connecting to the online server…' : 'Saving…', 'info');
    const r = await window.jgb.save(patch);
    busy(false);
    if (!r) return;
    if (r.state) st = r.state;
    render();
    if (!r.ok) status(r.error || 'Could not apply the settings.', 'err');
    else status('Saved. ' + (r.notice || ''), r.notice ? 'info' : 'ok');
  });
  $('#close').addEventListener('click', () => window.jgb.close());
  $('#quit').addEventListener('click', () => window.jgb.quit());
  $('#open-firewall').addEventListener('click', () => window.jgb.open('firewall'));
  $('#open-network').addEventListener('click', () => window.jgb.open('network'));
  $('#open-saves').addEventListener('click', () => window.jgb.open('saves'));
  $('#open-music').addEventListener('click', () => window.jgb.open('music'));
  $('#open-logs').addEventListener('click', () => window.jgb.open('logs'));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.jgb.close(); });

  window.jgb.state().then((s) => {
    st = s; render();
    tab(new URLSearchParams(location.search).get('tab') || (s.mode === 'online' ? 'mode' : 'phones'));
  });
})();
