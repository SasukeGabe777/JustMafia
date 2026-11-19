'use strict';
// End-to-end check of JustMafia's phone after JustGold (docs/justgold.md): the JustGold pouch,
// the link to the shared JustGold shop (/shop), the "Season & unlocks" screen (season pass,
// weekly challenges, unlocks, worlds, Fate, locked + achievements) and no item buying left in
// JustMafia. The private server enables the test-only JustGold grant.
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { io } = require('socket.io-client');
const { CHROME, Browser, startServer, cleanup, wait } = require('./cdp');

const PORT = 3992, URL = `http://localhost:${PORT}`;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'mt-e2e');
if (!CHROME) { console.log('SKIP e2e-shop: Chrome not found (set CHROME=path).'); process.exit(0); }
let passed = 0;
const ok = (name) => { passed++; console.log(`  ✓ ${name}`); };

(async () => {
  await startServer(PORT, { MT_DEV_GRANTS: '1' });
  const host = io(URL, { transports: ['websocket'] }); let tv = null; host.on('host:state', (s) => { tv = s; });
  const room = await new Promise((r) => host.emit('host:create', {}, r));
  const browser = new Browser({ shots: SHOTS, debugPort: 9334 }); await browser.launch();
  const a = await browser.page();
  const me = () => tv && tv.players.find((p) => p.name === 'Ana');
  const gold = () => a.eval(`Number((document.querySelector('#s-pouch b, #g-pouch b') || {}).textContent)`);
  // Test-only: run socket calls as this phone's own profile through a second socket in the page.
  const asMe = (body) => a.eval(`new Promise((done) => { const s = io(); const c = JSON.parse(localStorage.getItem('mt.profile')); s.emit('profile:resume', c, () => { const fin = (r) => { s.close(); done(r); }; ${body} }); })`);
  const grant = (amount) => asMe(`s.emit('dev:grant', { amount: ${amount} }, (r) => fin(r && r.ok));`);
  const NO_BUY_UI = `document.querySelectorAll('[data-buy], [data-item], [data-equip], [data-shop-tab], [data-open-shop], #s-scene, #s-say, #screen-shop').length`;

  // Join, move in, land in the lobby.
  await a.go(`${URL}/play?room=${room.code}`);
  await a.until(`!document.querySelector('#screen-creator').hidden && !document.querySelector('#j-go').disabled`, 'creator');
  // The creator links to the JustGold shop (also on the first join), with this room as the way back.
  const creatorLink = await a.eval(`(() => { const l = document.querySelector('#c-shop'); return { tag: l.tagName, hidden: l.hidden, text: l.textContent }; })()`);
  assert.equal(creatorLink.tag, 'A'); assert.equal(creatorLink.hidden, false); assert.match(creatorLink.text, /JustGold shop & character/);
  await a.eval(`document.querySelector('#j-name').value = 'Ana'`); await a.click('#j-go');
  await a.until(`!document.querySelector('#screen-home').hidden`, 'claim screen'); await a.click('#h-save');
  await a.until(`!document.querySelector('#screen-game').hidden && document.querySelector('#g-pouch')`, 'lobby with the JustGold pouch');
  assert.equal(await gold(), 0);
  assert.match(await a.eval(`document.querySelector('#g-pouch').textContent`), /JG/);
  await a.click('#g-pouch'); await a.until(`!document.querySelector('#g-pouch-pop').hidden && document.querySelector('[data-gold-balance]').textContent === '0'`, 'pouch details');
  assert.match(await a.eval(`document.querySelector('#g-pouch-pop').textContent`), /JustGold/);
  assert(await a.eval(`!!document.querySelector('#g-pouch-pop a[data-jg-shop]') && !!document.querySelector('#g-pouch-pop [data-open-season]')`), 'pouch links to the shop and Season & unlocks');
  await a.click('#g-pouch');
  ok('Every player has a JustGold pouch (JG) with balance / earned / spent, linking to the shop and Season & unlocks');

  // The lobby: a clear link to the shared JustGold shop that comes back to this room.
  const link = await a.eval(`(() => { const l = document.querySelector('#g-body a[data-jg-shop]'); return l && { text: l.textContent, href: l.getAttribute('href') }; })()`);
  assert(link, 'lobby has the JustGold shop link');
  assert.match(link.text, /🛍️ JustGold shop & character/);
  const u = new globalThis.URL(link.href, URL); assert.equal(u.pathname, '/shop');
  const back = new globalThis.URL(u.searchParams.get('back'), URL); assert.equal(back.pathname, '/play'); assert.equal(back.searchParams.get('room'), room.code);
  assert.match(await a.eval(`document.querySelector('#g-body [data-open-season]').textContent`), /🏆 Season & unlocks/);
  assert.equal(await a.eval(NO_BUY_UI), 0, 'no item-buy UI in the lobby');
  assert(await a.noOverflow()); await a.shot('lobby-justgold');
  ok(`Lobby: "🛍️ JustGold shop & character" → ${link.href}; "🏆 Season & unlocks" button`);

  // Season & unlocks: its tabs, each renders; nothing to buy but the pass and Fate.
  await a.click('#g-body [data-open-season]');
  await a.until(`!document.querySelector('#screen-season').hidden && document.querySelector('.pass-track')`, 'Season & unlocks opens on the season pass');
  const tabs = await a.eval(`[...document.querySelectorAll('[data-season-tab]')].map((b) => b.dataset.seasonTab)`);
  assert.deepEqual(tabs, ['season', 'weekly', 'unlocked', 'worlds', 'fate', 'locked']);
  assert(await a.eval(`!!document.querySelector('#screen-season a[data-jg-shop]')`), 'the screen links to the JustGold shop');
  assert(await a.noOverflow()); await a.shot('season-unlocks');
  const expect = { weekly: '.challenges li', unlocked: '.unlocked-head', worlds: '.world-card', fate: '.fate-card', locked: '.achievements li' };
  for (const [t, sel] of Object.entries(expect)) {
    await a.click(`[data-season-tab="${t}"]`);
    await a.until(`document.querySelector('[data-season-tab="${t}"]').classList.contains('sel') && document.querySelector('#s-grid ${sel}')`, 'tab ' + t);
    assert.equal(await a.eval(NO_BUY_UI), 0, 'no item-buy UI in ' + t);
    assert(await a.noOverflow(), 'no overflow in ' + t);
  }
  assert.match(await a.eval(`document.querySelector('#s-grid').textContent`), /Achievements \(0\/\d+\)/);
  await a.click('[data-season-tab="unlocked"]'); await a.until(`document.querySelector('.unlocked-head')`, 'unlocked'); await a.shot('season-unlocked');
  // Back and reopen.
  await a.click('#s-back'); await a.until(`!document.querySelector('#screen-game').hidden`, 'back to lobby');
  await a.click('#g-body [data-open-season]'); await a.until(`!document.querySelector('#screen-season').hidden`, 'reopens');
  ok(`Season & unlocks: tabs ${tabs.join(', ')}; no item shelves, Buy or Equip anywhere`);

  // The season pass is still bought here, with JustGold.
  await a.click('[data-season-tab="season"]'); await a.until(`document.querySelector('[data-buy-pass]')`, 'pass button');
  assert(await a.eval(`document.querySelector('[data-buy-pass]').disabled`), 'cannot afford it yet');
  assert.match(await a.eval(`document.querySelector('[data-buy-pass]').textContent`), /195 JG/);
  assert.match(await a.eval(`document.querySelector('.pass-head').textContent`), /195 more JustGold/);
  assert(await grant(300)); await a.until(`Number(document.querySelector('#s-pouch b').textContent) === 300`, 'JustGold arrives');
  await a.until(`!document.querySelector('[data-buy-pass]').disabled`, 'pass affordable');
  await a.click('[data-buy-pass]');
  await a.until(`document.querySelector('.pass-owned') && Number(document.querySelector('#s-pouch b').textContent) === 105`, 'pass bought');
  await a.click('[data-season-tab="fate"]'); await a.until(`document.querySelector('[data-fate-exchange]')`, 'fate');
  assert.match(await a.eval(`document.querySelector('[data-fate-exchange]').textContent`), /JG for 1 token/);
  ok('The season pass costs 195 JG and is bought on Season & unlocks; JustGold is deducted');

  // Coming back from the JustGold shop: the look it saved on the wallet shows on the phone and the seat.
  await a.click('#s-back'); await a.until(`!document.querySelector('#screen-game').hidden`, 'lobby');
  const newColor = await a.eval(`MT_OPTIONS.colors.find((c) => c !== JSON.parse(localStorage.getItem('mt.avatar')).color)`);
  const credsBefore = await a.eval(`localStorage.getItem('mt.profile')`);
  const saved = await asMe(`s.emit('profile:avatar', { avatar: { ...JSON.parse(localStorage.getItem('mt.avatar')), color: ${JSON.stringify(newColor)} } }, (r) => fin(r && r.ok));`);
  assert(saved, 'the wallet look changed elsewhere');
  await a.send('Page.reload'); await wait(400);
  await a.until(`!document.querySelector('#screen-game').hidden && document.querySelector('#g-pouch') && JSON.parse(localStorage.getItem('mt.avatar')).color === ${JSON.stringify(newColor)}`, 'phone picks up the saved look');
  for (let i = 0; i < 100 && me().avatar.color !== newColor; i++) await wait(30);
  assert.equal(me().avatar.color, newColor, 'the TV seat shows the new look');
  assert.equal(await a.eval(`localStorage.getItem('mt.profile')`), credsBefore, 'the wallet credentials are kept');
  assert.equal(await gold(), 105, 'JustGold after refresh');
  ok('Back from the JustGold shop: the wallet look wins over the phone copy and reaches the lobby seat; mt.profile unchanged');

  // Once the game starts the phone is purely the game: Season & unlocks closes, the shop link goes.
  await a.click('#g-body [data-open-season]'); await a.until(`!document.querySelector('#screen-season').hidden`, 'season open');
  await new Promise((r) => host.emit('host:action', { type: 'addBots', count: 5 }, r));
  await new Promise((r) => host.emit('host:action', { type: 'start' }, r));
  await a.until(`!document.querySelector('#screen-game').hidden && document.querySelector('#screen-season').hidden`, 'Season & unlocks closes when the game starts');
  await a.until(`document.querySelector('#g-body .draft-phone')`, 'the role draft opens');
  for (let i = 0; i < 5; i++) { await new Promise((r) => host.emit('host:action', { type: 'skip' }, r)); await wait(150); }
  await a.frames();
  await a.until(`document.querySelector('#g-body [data-role]')`, 'the role card renders once the game starts');
  assert.equal(await a.eval(`document.querySelectorAll('#g-body [data-jg-shop], #g-body [data-open-season], #g-body [data-edit], #g-body [data-house]').length`), 0, 'no shop/season/look/house in the game');
  await a.eval(`document.querySelector('#g-pouch-pop').hidden && document.querySelector('#g-pouch').click()`);
  await a.until(`!document.querySelector('#g-pouch-pop').hidden && document.querySelector('#g-pouch-pop [data-shop-closed]')`, 'pouch popover shows the shop closed');
  assert(await a.eval(`!document.querySelector('#g-pouch-pop [data-jg-shop]') && /JustGold shop opens between games/.test(document.querySelector('#g-pouch-pop').textContent)`));
  const refused = await asMe(`s.emit('profile:buy', { itemId: 'hat:helmet' }, (r1) => s.emit('profile:buyPass', {}, (r2) => s.emit('profile:avatar', { avatar: { hat: 'none' } }, (r3) => fin([r1, r2, r3]))));`);
  for (const r of refused) { assert.equal(r.ok, false); assert.match(r.error, /reopen after this game/); }
  await a.shot('game-no-shop');
  ok('After the game starts: no shop or Season & unlocks on the phone, and the server refuses buying and look changes');

  assert.deepEqual(a.errors, [], 'page errors: ' + a.errors.join('\n'));
  ok('No page errors');
  console.log(`All ${passed} JustGold phone end-to-end checks passed. Screenshots: ${SHOTS}`);
  host.close();
})().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => { cleanup(); setTimeout(() => process.exit(), 300).unref(); });
