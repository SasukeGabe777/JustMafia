'use strict';
// End-to-end "Save your stuff" (public/account-ui.js, docs/justgold.md): a JustMafia phone with
// JustGold saves it under a name + password from the lobby; a second phone signs in from the
// shop and sees the same gold; a third signs in from the box phone's join screen; change the
// password and sign out. Every phone is a separate browser context (its own localStorage).
//   node tools/e2e-account.js
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { io } = require('socket.io-client');
const { CHROME, Browser, startServer, cleanup, wait } = require('./cdp');

const PORT = 3973, URL = `http://localhost:${PORT}`;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'mt-e2e');
if (!CHROME) { console.log('SKIP e2e-account: Chrome not found (set CHROME=path).'); process.exit(0); }
let passed = 0;
const ok = (name) => { passed++; console.log(`  ✓ ${name}`); };
const PW = 'Sunny Pizza 7!';

(async () => {
  await startServer(PORT, { MT_DEV_GRANTS: '1' });
  const host = io(URL, { transports: ['websocket'] });
  const room = await new Promise((r) => host.emit('host:create', {}, r));
  const browser = new Browser({ shots: SHOTS, debugPort: 9373 }); await browser.launch();
  const fill = (pg, sel, v) => pg.eval(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  const submit = (pg) => pg.eval(`(() => { const f = document.querySelector('#jga-sheet form'); f.requestSubmit(); return true; })()`);

  // ---- Phone A: JustMafia, earns JustGold, saves it from the lobby ----
  const a = await browser.page();
  await a.go(`${URL}/play?room=${room.code}`);
  await a.until(`!document.querySelector('#screen-creator').hidden && !document.querySelector('#j-go').disabled`, 'creator');
  await a.until(`document.querySelector('#screen-creator [data-acct] .jga-banner')`, 'account line in the creator');
  await a.eval(`document.querySelector('#j-name').value = 'Ana'`); await a.click('#j-go');
  await a.until(`!document.querySelector('#screen-home').hidden`, 'claim screen'); await a.click('#h-save');
  await a.until(`!document.querySelector('#screen-game').hidden && document.querySelector('#g-pouch')`, 'lobby');
  assert(await a.eval(`new Promise((done) => { const s = io(); const c = JSON.parse(localStorage.getItem('mt.profile')); s.emit('profile:resume', c, () => s.emit('dev:grant', { amount: 120 }, (r) => { s.close(); done(r && r.ok); })); })`));
  await a.until(`/Save your stuff/.test((document.querySelector('#g-body [data-acct]') || {}).textContent || '')`, '"Save your stuff" banner in the lobby', 10000);
  await a.shot('account-mafia-unsaved');
  await a.click('#g-body [data-acct] [data-jga="save"]');
  await a.until(`document.querySelector('#jga-sheet form[data-form="save"]')`, 'save form');
  const fields = await a.eval(`(() => { const n = document.querySelector('#jga-name'), p = document.querySelector('#jga-pw'); return { n: n.autocomplete, p: p.autocomplete, type: p.type, text: document.querySelector('#jga-sheet').textContent }; })()`);
  assert.equal(fields.n, 'username'); assert.equal(fields.p, 'new-password'); assert.equal(fields.type, 'password');
  assert.match(fields.text, /120 JustGold/, 'says how much gold is at stake');
  await a.shot('account-save-sheet');
  await a.click('[data-eye="jga-pw"]'); assert.equal(await a.eval(`document.querySelector('#jga-pw').type`), 'text', 'show password');
  await a.click('[data-eye="jga-pw"]'); assert.equal(await a.eval(`document.querySelector('#jga-pw').type`), 'password', 'hide password');
  await fill(a, '#jga-name', 'AnaSaves'); await fill(a, '#jga-pw', 'abc'); await submit(a);
  await a.until(`/at least 4/.test(document.querySelector('#jga-sheet [data-err]').textContent)`, 'too short message');
  await fill(a, '#jga-pw', PW); await submit(a);
  await a.until(`!document.querySelector('#jga-sheet')`, 'sheet closes after saving', 8000);
  await a.until(`/Saved as/.test((document.querySelector('#g-body [data-acct]') || {}).textContent || '')`, 'Saved as in the lobby', 8000);
  await a.shot('account-mafia-lobby');
  ok('JustMafia phone: "Save your stuff" in the lobby with the gold; name + password (show/hide, min 4); then "Saved as"');

  // ---- Phone B: the shop, signs in, sees the same gold ----
  const b = await browser.page();
  await b.go(`${URL}/shop`);
  await b.until(`!document.querySelector('#start').hidden && document.querySelector('#s-swap')`, 'shop start');
  await b.click('#s-swap');
  await b.until(`document.querySelector('#s-pin')`, 'shop sign-in');
  const sf = await b.eval(`({ n: document.querySelector('#s-name').autocomplete, p: document.querySelector('#s-pin').autocomplete, text: document.querySelector('#start').textContent })`);
  assert.equal(sf.n, 'username'); assert.equal(sf.p, 'current-password'); assert.match(sf.text, /password/); assert.doesNotMatch(sf.text, /PIN/);
  await fill(b, '#s-name', 'anasaves'); await fill(b, '#s-pin', 'wrong pw'); await b.eval(`document.querySelector('#s-form').requestSubmit()`);
  await b.until(`/don.t match/.test(document.querySelector('#s-err').textContent)`, 'wrong password message');
  await fill(b, '#s-pin', PW); await b.eval(`document.querySelector('#s-form').requestSubmit()`);
  await b.until(`window.JG_SHOP.state().st && !document.querySelector('#left').hidden`, 'shop loaded', 10000);
  assert.equal(await b.eval(`window.JG_SHOP.state().st.gold`), 120, 'the same JustGold on the new phone');
  await b.until(`/Saved as/.test(document.querySelector('#acct').textContent)`, 'Saved as in the shop');
  assert(await b.eval(`!!JSON.parse(localStorage.getItem('mt.profile'))`), 'the wallet is on this phone too (JustMafia uses it)');
  // Change the password from the shop, then sign out.
  await b.click('#acct [data-jga="account"]');
  await b.until(`document.querySelector('#jga-sheet [data-go="change"]')`, 'account sheet');
  await b.click('#jga-sheet [data-go="change"]');
  await b.until(`document.querySelector('#jga-old')`, 'change form');
  assert.equal(await b.eval(`document.querySelector('#jga-new').autocomplete`), 'new-password');
  await fill(b, '#jga-old', 'not it'); await fill(b, '#jga-new', 'New Pass 99'); await submit(b);
  await b.until(`/current password/.test(document.querySelector('#jga-sheet [data-err]').textContent)`, 'wrong old password');
  await fill(b, '#jga-old', PW); await submit(b);
  await b.until(`document.querySelector('#jga-sheet [data-go="signout"]')`, 'back to Saved as after the change');
  await b.eval(`window.confirm = () => true`);
  await b.click('#jga-sheet [data-go="signout"]');
  await b.until(`!document.querySelector('#start').hidden && document.querySelector('#s-pin')`, 'signed out: the sign-in screen', 8000);
  assert.equal(await b.eval(`localStorage.getItem('box.profile')`), null);
  ok('Shop: sign in (wrong password refused), same 120 JG; change password (needs the old one); sign out');

  // ---- Phone C: the box phone, sign in from the join screen, then join a box game ----
  const tv = io(URL + '/box', { transports: ['websocket'] });
  const boxRoom = await new Promise((r) => tv.emit('host:create', { game: 'likely' }, r));
  const c = await browser.page();
  await c.go(`${URL}/box/play?room=${boxRoom.code}`);
  await c.until(`document.querySelector('#j-acct [data-jga="signin"]')`, 'Sign in link on the join screen');
  await c.click('#j-acct [data-jga="signin"]');
  await c.until(`document.querySelector('#jga-lpw')`, 'sign-in form');
  assert.equal(await c.eval(`document.querySelector('#jga-lpw').autocomplete`), 'current-password');
  await fill(c, '#jga-lname', 'AnaSaves'); await fill(c, '#jga-lpw', PW); await submit(c);
  await c.until(`/don.t match/.test(document.querySelector('#jga-sheet [data-err]').textContent)`, 'the old password no longer works');
  await fill(c, '#jga-lpw', 'New Pass 99'); await submit(c);
  await c.until(`!document.querySelector('#jga-sheet') && /Saved as/.test(document.querySelector('#j-acct').textContent)`, 'signed in on the join screen', 8000);
  assert.equal(await c.eval(`document.querySelector('#j-name').value`), 'AnaSaves', 'the name is filled in');
  await c.shot('account-box-join');
  await c.click('#j-go');
  await c.until(`!document.querySelector('#game').hidden`, 'in the box room');
  await c.click('#h-prof');
  await c.until(`document.querySelector('[data-tab="account"]')`, 'profile sheet');
  assert.match(await c.eval(`document.querySelector('[data-tab="account"]').textContent`), /Saved/);
  await c.click('[data-tab="account"]');
  await c.until(`/Saved as AnaSaves/.test((document.querySelector('#pf-acct') || {}).textContent || '')`, 'Saved as in 🏆 My profile');
  const st = await c.eval(`new Promise((done) => { const s = io('/box'); s.emit('shop:state', { auth: JSON.parse(localStorage.getItem('box.profile')) }, (r) => { s.close(); done(r); }); })`);
  assert(st.ok); assert.equal(st.gold, 120, 'the box phone has the same wallet');
  ok('Box phone: Sign in from the join screen (new password), joins with the account; 🏆 My profile says Saved');

  // ---- Phone D: brand new in the shop: no "Save your stuff" before a first finished game ----
  const d = await browser.page();
  await d.go(`${URL}/shop`);
  await d.until(`!document.querySelector('#start').hidden && document.querySelector('#s-go')`, 'shop start (new)');
  await fill(d, '#s-name', 'Dee'); await d.click('#s-go');
  await d.until(`/Sign in/.test(document.querySelector('#acct').textContent)`, 'shop: only "Sign in" before a first game', 10000);
  assert(!(await d.eval(`/Save your stuff/.test(document.querySelector('#acct').textContent)`)), 'no "Save your stuff" before a finished game');
  // After a finished game (this phone's flag; the box phone sets it at the end of a real game).
  await d.eval(`localStorage.setItem('jg.played', '1'); true`); await d.go(`${URL}/shop`);
  await d.until(`/Save your stuff/.test((document.querySelector('#acct') || {}).textContent || '')`, 'shop banner after a finished game', 10000);
  await d.shot('account-shop-unsaved');
  ok('Shop: a new account shows only "Sign in"; "Save your stuff" over the character once a game is finished');

  for (const [n, pg] of [['mafia', a], ['shop', b], ['box', c], ['new shop', d]]) assert.deepEqual(pg.errors, [], `no page errors on the ${n} phone`);
  ok('no page errors');
  console.log(`\nAll ${passed} account e2e checks passed. Screenshots: ${SHOTS}`);
  host.close(); tv.close(); cleanup(); process.exit(0);
})().catch((e) => { console.error(e); cleanup(); process.exit(1); });
