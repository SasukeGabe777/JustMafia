'use strict';
// "Save your stuff": one small account panel shared by the box phone (/box/play), the JustGold
// shop (/shop) and JustMafia's phone (/play). A name + password saves the JustGameBox account
// (box/profiles.js) and with it the wallet (JustGold, items, the character) and the stats, so the
// same player can sign in on any phone. Server events (/box namespace): account:status,
// profile:create, account:wallet, profile:claim, profile:login, profile:password, profile:logout.
//
//   const acct = JGAccount.create({ socket, keys, onChange, toast, haptic });
//   acct.open('save' | 'signin' | 'account')   a sheet over the page
//   acct.panel(el, mode)                         the same form inside any element
//   acct.banner(el, { join })                    "Save your stuff" card / "Saved as NAME ✓" line
//   acct.nudge(where, { earned })                after a finished game: "You earned 15 JG! Save it…"
//   acct.markPlayed() / played()                 this phone finished a real game (local flag)
// The "Save your stuff" card never shows before the player has finished a game (games played on
// the account, JustGold earned, or this phone's flag): until then only a small "Sign in" link.
//   onChange(kind) with kind = 'saved' | 'signin' | 'signout' | 'password'
(function () {
  const MIN = 4, MAX = 64;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CSS = `
.jga-bg{position:fixed;inset:0;background:rgba(8,4,24,.62);z-index:9000}
.jga-sheet{position:fixed;left:50%;bottom:0;transform:translateX(-50%);width:min(440px,100%);max-height:92vh;overflow:auto;z-index:9001;background:#211846;color:#fff;border-radius:20px 20px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom));box-shadow:0 -10px 40px rgba(0,0,0,.45);font-family:inherit;box-sizing:border-box}
.jga-sheet .jga-x{position:absolute;right:10px;top:8px;background:none;border:0;color:#fff;font-size:22px;padding:6px 10px;cursor:pointer}
.jga{font-family:inherit;color:inherit;text-align:left}
.jga h3{margin:0 0 6px;font-size:20px}
.jga p{margin:6px 0;line-height:1.35}
.jga .jga-muted{opacity:.75;font-size:13px}
.jga label{display:block;margin:10px 0 4px;font-weight:600;font-size:14px;color:#e9e2ff;text-align:left}
.jga .jga-pw{display:flex;gap:6px;align-items:stretch}
.jga input{width:100%;box-sizing:border-box;font:inherit;font-size:17px;padding:11px 12px;border-radius:12px;border:2px solid rgba(255,255,255,.25);background:rgba(255,255,255,.95);color:#1b1240}
.jga input:focus{outline:none;border-color:#ffd23f}
.jga .jga-eye{flex:0 0 auto;font:inherit;font-size:14px;border-radius:12px;border:2px solid rgba(255,255,255,.25);background:rgba(255,255,255,.12);color:inherit;padding:0 12px;cursor:pointer;min-width:64px}
.jga .jga-go{display:block;width:100%;margin-top:14px;font:inherit;font-weight:700;font-size:18px;padding:13px;border:0;border-radius:14px;background:#2ecc71;color:#08301a;cursor:pointer}
.jga .jga-go.alt{background:#ffd23f;color:#3a2a00}
.jga .jga-go.ghost{background:rgba(255,255,255,.12);color:inherit;font-size:16px}
.jga .jga-go:disabled{opacity:.6}
.jga .jga-link{background:none;border:0;color:#ffd23f;font:inherit;font-weight:600;text-decoration:underline;padding:10px 0 0;cursor:pointer;display:block}
.jga .jga-err{color:#ff8a8a;min-height:1.2em;font-weight:600;margin:8px 0 0}
.jga .jga-ok{font-size:18px;font-weight:700}
.jga .jga-row{display:flex;gap:8px;flex-wrap:wrap}.jga .jga-row .jga-go{flex:1 1 140px}
.jga-banner{display:flex;align-items:center;gap:10px;padding:10px 12px;margin:10px 0;border-radius:14px;background:linear-gradient(135deg,#ffd23f,#ffb03f);color:#3a2a00;text-align:left;font-family:inherit;box-shadow:0 4px 14px rgba(0,0,0,.2)}
.jga-banner .jga-bi{font-size:26px;flex:0 0 auto}
.jga-banner .jga-bt{flex:1 1 auto;min-width:0;font-size:14px;line-height:1.3}.jga-banner .jga-bt b{display:block;font-size:16px}
.jga-banner button{flex:0 0 auto;font:inherit;font-weight:700;border:0;border-radius:12px;padding:9px 14px;background:#2a1d5c;color:#fff;cursor:pointer}
.jga-banner.saved{background:#1d3b2c;color:#eafff2;box-shadow:none;border:1px solid rgba(46,204,113,.6)}
.jga-banner.saved button{background:rgba(255,255,255,.14)}
.jga-banner.slim{background:rgba(20,12,44,.55);box-shadow:none;padding:8px 12px;margin:6px 0;color:#fff;justify-content:center;text-align:center}
.jga-banner.slim button{background:none;color:#ffd23f;text-decoration:underline;padding:4px}
.jga-nudge{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(12px + env(safe-area-inset-bottom));width:min(420px,calc(100% - 20px));z-index:8000;margin:0}
.jga-toast{position:fixed;left:50%;top:calc(14px + env(safe-area-inset-top));transform:translateX(-50%);z-index:9100;background:#211846;color:#fff;padding:10px 16px;border-radius:14px;font-weight:600;box-shadow:0 6px 20px rgba(0,0,0,.4);max-width:calc(100% - 32px);text-align:center}
.jga-toast[hidden]{display:none}
.jga-nudge .jga-later{background:none;color:#3a2a00;text-decoration:underline;padding:6px}`;
  function styles() { if (document.getElementById('jga-css')) return; const s = document.createElement('style'); s.id = 'jga-css'; s.textContent = CSS; document.head.appendChild(s); }

  function create(opts = {}) {
    const K = { account: 'box.profile', wallet: 'mt.profile', name: 'box.name', ...(opts.keys || {}) };
    let socket = opts.socket || null;
    const sock = () => socket || (socket = window.io('/box', { transports: ['websocket', 'polling'] }));
    const toast = (m) => {
      try {
        if (opts.toast) return opts.toast(m);
        styles(); let t = document.getElementById('jga-toast');
        if (!t) { t = document.createElement('div'); t.id = 'jga-toast'; t.className = 'jga-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
        t.textContent = m; t.hidden = false; clearTimeout(t._t); t._t = setTimeout(() => { t.hidden = true; }, 2800);
      } catch (e) { /* none */ }
    };
    const hap = (k) => { try { if (opts.haptic) opts.haptic(k); else if (window.HAPTIC) window.HAPTIC.play(k); } catch (e) { /* none */ } };
    const getJ = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
    const setJ = (k, v) => { try { if (v) localStorage.setItem(k, JSON.stringify(v)); else localStorage.removeItem(k); } catch (e) { /* private mode */ } };
    const PLAYED = K.played || 'jg.played';
    const played = () => { try { return localStorage.getItem(PLAYED) === '1'; } catch (e) { return false; } };
    const markPlayed = () => { try { localStorage.setItem(PLAYED, '1'); } catch (e) { /* private mode */ } };
    const hasStuff = (s) => !!(s && (s.gold > 0 || s.games > 0 || played()));
    const pair = (p) => (p && typeof p.id === 'string' && typeof p.token === 'string' ? { id: p.id, token: p.token } : null);
    const auth = () => pair(getJ(K.account));
    const wallet = () => pair(getJ(K.wallet));
    const call = (ev, msg, ms = 8000) => new Promise((res) => {
      let done = false;
      const t = setTimeout(() => { if (!done) { done = true; res({ ok: false, error: 'No answer from the server. Check your connection.' }); } }, ms);
      sock().emit(ev, msg, (r) => { if (done) return; done = true; clearTimeout(t); res(r && typeof r === 'object' ? r : { ok: false, error: 'No answer from the server.' }); });
    });
    let last = null; const watchers = new Set();
    const changed = (kind, info) => { last = null; for (const fn of watchers) { try { fn(kind, info); } catch (e) { /* */ } } try { if (opts.onChange) opts.onChange(kind, info); } catch (e) { console.error(e); } };

    async function status() { const r = await call('account:status', { auth: auth(), mafia: wallet() }); if (r.ok) last = r; return r; }
    // This phone needs an account (and its wallet linked) before it can be saved.
    async function ensureAccount(name) {
      if (auth()) { const s = await status(); if (s.ok && s.account) return { ok: true }; if (!s.ok) return s; }
      const r = await call('profile:create', { name });
      if (!r.ok || !r.id) return { ok: false, error: r.error || 'Could not make your account. Try again.' };
      setJ(K.account, { id: r.id, token: r.token }); return { ok: true };
    }
    async function linkWallet() { const r = await call('account:wallet', { auth: auth(), mafia: wallet() }); if (r.ok && r.wallet) setJ(K.wallet, pair(r.wallet)); return r; }
    const remember = (name) => { try { localStorage.setItem(K.name, name); } catch (e) { /* private */ } };
    async function save(name, password) {
      const a = await ensureAccount(name); if (!a.ok) return a;
      await linkWallet(); // the JustGold on this phone goes with the account
      const r = await call('profile:claim', { auth: auth(), name, password });
      if (r.ok) { remember(r.profile && r.profile.claimed || name); changed('saved', { name: r.profile && r.profile.claimed }); }
      return r;
    }
    async function signIn(name, password) {
      const r = await call('profile:login', { name, password });
      if (!r.ok || !r.id) return r.ok ? { ok: false, error: 'That didn’t work. Try again.' } : r;
      setJ(K.account, { id: r.id, token: r.token }); remember(r.profile && r.profile.claimed || name);
      const w = await linkWallet();
      changed('signin', { name: r.profile && r.profile.claimed, wallet: w.ok ? w.wallet : null });
      return r;
    }
    async function changePassword(old, password) { const r = await call('profile:password', { auth: auth(), old, password }); if (r.ok) changed('password'); return r; }
    async function signOut() {
      const r = await call('profile:logout', { auth: auth() });
      if (!r.ok) return r;
      setJ(K.account, null); setJ(K.wallet, null);
      changed('signout'); return r;
    }

    // ---------- the form ----------
    const pwField = (id, label, ac) => `<label for="${id}">${label}</label><div class="jga-pw"><input id="${id}" type="password" minlength="${MIN}" maxlength="${MAX}" autocomplete="${ac}" autocapitalize="off" spellcheck="false"><button type="button" class="jga-eye" data-eye="${id}" aria-label="Show password">Show</button></div>`;
    const nameField = (id, v) => `<label for="${id}">Name</label><input id="${id}" maxlength="14" autocomplete="username" autocapitalize="words" spellcheck="false" value="${esc(v || '')}">`;
    const stuff = (s) => (s && s.gold > 0 ? `your <b>${s.gold} JustGold</b>, character, items and stats` : 'your JustGold, character, items and stats');
    async function panel(el, mode = 'auto', onDone) {
      styles();
      el.innerHTML = '<div class="jga"><p class="jga-muted">Loading…</p></div>';
      const s = await status();
      if (!s.ok) { el.innerHTML = `<div class="jga"><p class="jga-err">${esc(s.error || 'Not available right now.')}</p></div>`; return; }
      if (mode === 'auto' || mode === 'account') mode = s.saved ? 'saved' : 'save';
      if (mode === 'save' && s.saved) mode = 'saved';
      let nm = s.name || (opts.name && opts.name()) || ''; try { nm = nm || localStorage.getItem(K.name) || ''; } catch (e) { /* private */ }
      let html = '';
      if (mode === 'saved') {
        html = `<p class="jga-ok">✅ Saved as ${esc(s.name)}</p><p class="jga-muted">Your JustGold${s.gold ? ` (${s.gold} JG)` : ''}, character, items and stats are saved. On another phone, tap <b>Sign in</b> and use this name and password.</p>
          <div class="jga-row"><button class="jga-go ghost" data-go="change">🔑 Change password</button><button class="jga-go ghost" data-go="signout">🚪 Sign out</button></div>`;
      } else if (mode === 'save') {
        html = `<h3>💾 Save your stuff</h3><p>Pick a name and a password to keep ${stuff(s)}. Then you can sign in on any phone.</p>
          <form data-form="save" autocomplete="on">${nameField('jga-name', nm)}${pwField('jga-pw', `Password <span class="jga-muted">(${MIN}+ characters)</span>`, 'new-password')}
          <button class="jga-go" type="submit">💾 Save my stuff</button></form><p class="jga-err" data-err></p>
          <button class="jga-link" data-go="signin">Already saved on another phone? Sign in</button>`;
      } else if (mode === 'signin') {
        const lose = !s.saved && s.gold > 0;
        html = `<h3>👋 Welcome back!</h3><p>Sign in with the name and password you saved. Your JustGold, character and stats come with you.</p>
          <form data-form="signin" autocomplete="on">${nameField('jga-lname', s.saved ? '' : nm)}${pwField('jga-lpw', 'Password', 'current-password')}
          <button class="jga-go alt" type="submit">Sign in</button></form><p class="jga-err" data-err></p>
          ${lose ? `<p class="jga-muted">⚠️ This phone has ${s.gold} JG that isn’t saved. Signing in switches to your saved account.</p>` : ''}
          ${s.saved ? '' : '<button class="jga-link" data-go="save">New here? Save this phone’s stuff instead</button>'}`;
      } else if (mode === 'change') {
        html = `<h3>🔑 Change password</h3><p class="jga-muted">Saved as <b>${esc(s.name)}</b>.</p>
          <form data-form="change" autocomplete="on"><input type="text" autocomplete="username" value="${esc(s.name)}" hidden readonly>${pwField('jga-old', 'Current password', 'current-password')}${pwField('jga-new', `New password <span class="jga-muted">(${MIN}+ characters)</span>`, 'new-password')}
          <button class="jga-go" type="submit">Save new password</button></form><p class="jga-err" data-err></p><button class="jga-link" data-go="saved">Back</button>`;
      }
      el.innerHTML = `<div class="jga">${html}</div>`;
      const err = (m) => { const e = el.querySelector('[data-err]'); if (e) e.textContent = m || ''; if (m) hap('error'); };
      for (const b of el.querySelectorAll('[data-eye]')) b.onclick = () => { const i = el.querySelector('#' + b.dataset.eye); const show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.textContent = show ? 'Hide' : 'Show'; b.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); i.focus(); };
      for (const b of el.querySelectorAll('[data-go]')) b.onclick = async () => {
        const g = b.dataset.go;
        if (g === 'signout') {
          if (!confirm('Sign out on this phone? Your stuff stays saved: sign in again with your name and password.')) return;
          b.disabled = true; const r = await signOut(); b.disabled = false;
          if (!r.ok) return toast(r.error || 'Could not sign out.');
          hap('success'); toast('👋 Signed out'); if (onDone) onDone('signout'); else panel(el, 'signin', onDone);
          return;
        }
        panel(el, g, onDone);
      };
      const form = el.querySelector('[data-form]');
      if (!form) return;
      const first = form.querySelector('input:not([hidden])'); if (first && !first.value && !matchMedia('(pointer:coarse)').matches) first.focus();
      form.onsubmit = async (e) => {
        e.preventDefault(); err('');
        const v = (id) => { const i = form.querySelector('#' + id); return i ? i.value : ''; };
        const go = form.querySelector('.jga-go');
        const kind = form.dataset.form;
        const name = (v('jga-name') || v('jga-lname')).replace(/[<>&"]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14);
        const pw = v('jga-pw') || v('jga-lpw') || v('jga-new');
        if (kind !== 'change' && name.length < 2) return err('Type your name (2+ letters).');
        if (kind === 'change' && !v('jga-old')) return err('Type your current password.');
        if (pw.length < MIN) return err(kind === 'signin' ? 'Type your password.' : `The password needs at least ${MIN} characters.`);
        go.disabled = true;
        const r = kind === 'save' ? await save(name, pw) : kind === 'signin' ? await signIn(name, pw) : await changePassword(v('jga-old'), pw);
        go.disabled = false;
        if (!r.ok) return err(r.error || 'That didn’t work. Try again.');
        hap('success');
        toast(kind === 'save' ? '💾 Saved! Sign in on any phone with your name and password.' : kind === 'signin' ? `👋 Signed in as ${(r.profile && r.profile.claimed) || name}` : '🔑 Password changed');
        if (onDone) onDone(kind); else panel(el, 'saved', onDone);
      };
    }
    // A sheet over the page with the panel in it.
    function open(mode = 'auto') {
      styles(); close();
      const bg = document.createElement('div'); bg.className = 'jga-bg'; bg.id = 'jga-bg';
      const sh = document.createElement('div'); sh.className = 'jga-sheet'; sh.id = 'jga-sheet'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-label', 'Save your stuff');
      sh.innerHTML = '<button class="jga-x" aria-label="Close">✕</button><div class="jga-body"></div>';
      document.body.append(bg, sh);
      bg.onclick = close; sh.querySelector('.jga-x').onclick = close;
      panel(sh.querySelector('.jga-body'), mode, (kind) => { if (kind === 'change' || kind === 'password') return panel(sh.querySelector('.jga-body'), 'saved'); close(); });
    }
    function close() { for (const id of ['jga-bg', 'jga-sheet']) { const n = document.getElementById(id); if (n) n.remove(); } }
    // The card that says it: "Save your stuff" (not saved) or "Saved as NAME ✓".
    // join: the slim version for the box join screen (only a sign-in link when nothing to save).
    async function banner(el, o = {}) {
      if (!el) return null; styles();
      const s = await status(); if (!s.ok) { el.innerHTML = ''; return s; }
      const has = hasStuff(s);
      if (s.saved) el.innerHTML = `<div class="jga-banner saved"><span class="jga-bi">✅</span><span class="jga-bt">Saved as <b style="display:inline">${esc(s.name)}</b>${s.gold ? ` · ${s.gold} JG` : ''}</span><button data-jga="account">Account</button></div>`;
      else if (!has) el.innerHTML = // nothing to save before the first finished game: just the sign-in link
 '<div class="jga-banner slim"><span class="jga-bt">Played before? <button data-jga="signin">Sign in</button> to get your JustGold back.</span></div>';
      else el.innerHTML = `<div class="jga-banner"><span class="jga-bi">💾</span><span class="jga-bt"><b>Save your stuff</b>${s.gold ? `Your ${s.gold} JG, ` : 'Your '}character and stats live on this phone only.</span><button data-jga="save">Save</button></div>${o.join ? '<div class="jga-banner slim"><span class="jga-bt">Already saved? <button data-jga="signin">Sign in</button></span></div>' : ''}`;
      for (const b of el.querySelectorAll('[data-jga]')) b.onclick = () => open(b.dataset.jga);
      return s;
    }
    // A one-time reminder after a game, when there is something worth saving.
    async function nudge(where = document.body, o = {}) {
      try { if (sessionStorage.getItem('jga.nudged')) return; } catch (e) { /* */ }
      const s = await status(); if (!s.ok || s.saved || !hasStuff(s)) return;
      if (document.getElementById('jga-nudge')) return;
      try { sessionStorage.setItem('jga.nudged', '1'); } catch (e) { /* */ }
      styles();
      const n = document.createElement('div'); n.id = 'jga-nudge'; n.className = 'jga-banner jga-nudge';
      const earned = Math.max(0, Math.round(Number(o.earned) || 0));
      n.innerHTML = `<span class="jga-bi">${earned ? '🪙' : '💾'}</span><span class="jga-bt"><b>${earned ? `You earned ${earned} JG!` : 'Save your stuff'}</b>${earned ? `Save it with a name + password${s.gold > earned ? ` (you have ${s.gold} JG)` : ''} and play on any phone.` : `Keep ${s.gold ? `your ${s.gold} JG` : 'your stats'} with a name and password.`}</span><button data-jga="save">Save</button><button class="jga-later" data-later aria-label="Later">Later</button>`;
      where.appendChild(n);
      n.querySelector('[data-jga]').onclick = () => { n.remove(); open('save'); };
      n.querySelector('[data-later]').onclick = () => n.remove();
      setTimeout(() => n.remove(), 20000);
    }
    return { markPlayed, played, status, save, signIn, signOut, changePassword, linkWallet, panel, open, close, banner, nudge, auth, wallet, last: () => last, watch: (fn) => { watchers.add(fn); return () => watchers.delete(fn); } };
  }
  window.JGAccount = { create, MIN, MAX };
})();
