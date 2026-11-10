'use strict';
// End-to-end check of the shop, gold pouch and inventory in headless Chrome.
// Run with `npm run test:e2e`. The private server enables the test-only gold grant.
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
  // Test-only: grant gold to this phone's own profile through a second socket in the page.
  const grant = (amount) => a.eval(`new Promise((done) => { const s = io(); const c = JSON.parse(localStorage.getItem('mt.profile')); s.emit('profile:resume', c, () => s.emit('dev:grant', { amount: ${amount} }, (r) => { s.close(); done(r && r.ok); })); })`);

  // Join, move in, land in the lobby.
  await a.go(`${URL}/play?room=${room.code}`);
  await a.until(`!document.querySelector('#screen-creator').hidden && !document.querySelector('#j-go').disabled`, 'creator');
  await a.eval(`document.querySelector('#j-name').value = 'Ana'`); await a.click('#j-go');
  await a.until(`!document.querySelector('#screen-home').hidden`, 'claim screen'); await a.click('#h-save');
  await a.until(`!document.querySelector('#screen-game').hidden && document.querySelector('#g-pouch')`, 'lobby with gold pouch');
  assert.equal(await gold(), 0);
  await a.click('#g-pouch'); await a.until(`!document.querySelector('#g-pouch-pop').hidden && document.querySelector('[data-gold-balance]').textContent === '0'`, 'pouch details');
  ok('Every player has a visible gold pouch with balance / earned / spent details');

  // Open the shop: a counter scene, sections, shelves; no overflow at phone width.
  await a.click('[data-open-shop]');
  await a.until(`!document.querySelector('#screen-shop').hidden && document.querySelector('#s-scene').width > 0 && document.querySelectorAll('.shop-tile canvas').length && [...document.querySelectorAll('.shop-tile canvas')].every((c) => c.width > 0)`, 'shop opens');
  const tabs = await a.eval(`[...document.querySelectorAll('[data-shop-tab]')].map((b) => b.dataset.shopTab)`);
  for (const t of ['clothing', 'accessories', 'house', 'inventory']) assert(tabs.includes(t), 'tab ' + t);
  assert(await a.noOverflow()); await a.shot('shop-open');
  // Close and reopen.
  await a.click('#s-back'); await a.until(`!document.querySelector('#screen-game').hidden`, 'back to lobby');
  await a.click('[data-open-shop]'); await a.until(`!document.querySelector('#screen-shop').hidden`, 'shop reopens');
  ok(`Shop opens and closes; sections: ${tabs.join(', ')}`);

  // Preview an item; it is unaffordable, so Buy is disabled and the shopkeeper says so.
  await a.click('[data-shop-tab="house"]'); await a.click('[data-item="houseStyle:darkMansion"]');
  await a.until(`document.querySelector('#s-scene').dataset.selected === 'houseStyle:darkMansion'`, 'item on the counter');
  assert(await a.eval(`document.querySelector('[data-buy]').disabled && /Need 140 more gold/.test(document.querySelector('[data-cant]').textContent)`));
  assert.match(await a.eval(`document.querySelector('#s-say').textContent`), /140 gold.*You have 0/);
  assert.match(await a.eval(`document.querySelector('#s-detail').textContent`), /gloomy mansion/);
  await a.shot('shop-preview');
  ok('Selecting an item previews it on the counter with description and price; unaffordable items cannot be bought');

  // Earn gold, buy it: gold is deducted, the item is owned and in the inventory.
  assert(await grant(300)); await a.until(`Number(document.querySelector('#s-pouch b').textContent) === 300`, 'gold arrives');
  await a.until(`!document.querySelector('[data-buy]').disabled`, 'buy enabled');
  await a.click('[data-buy]');
  await a.until(`Number(document.querySelector('#s-pouch b').textContent) === 160 && document.querySelector('[data-item="houseStyle:darkMansion"] .badge.own')`, 'purchase completes');
  assert.match(await a.eval(`document.querySelector('#s-say').textContent`), /Thank you/);
  await a.click('[data-shop-tab="accessories"]'); await a.click('[data-item="hat:hood"]');
  const hoodPrice = await a.eval(`MT_COSMETICS.CATALOG.find((i) => i.id === 'hat:hood').cost`);
  await a.click('[data-buy]'); await a.until(`Number(document.querySelector('#s-pouch b').textContent) === ${160 - hoodPrice}`, 'second purchase');
  ok(`Buying deducts exactly the price (140 + ${hoodPrice} gold) and marks items owned`);

  // Inventory: equip the house and the hat; the TV shows them. Unequip works too.
  await a.click('[data-shop-tab="inventory"]');
  await a.until(`[...document.querySelectorAll('.shop-tile')].map((b) => b.dataset.item).sort().join() === 'hat:hood,houseStyle:darkMansion'`, 'inventory lists purchases');
  await a.click('[data-item="houseStyle:darkMansion"]'); await a.click('[data-equip]');
  for (let i = 0; i < 100 && me().homeLook.style !== 'darkMansion'; i++) await wait(30);
  assert.equal(me().homeLook.style, 'darkMansion');
  await a.click('[data-item="hat:hood"]'); await a.click('[data-equip]');
  for (let i = 0; i < 100 && me().avatar.hat !== 'hood'; i++) await wait(30);
  assert.equal(me().avatar.hat, 'hood');
  await a.until(`document.querySelectorAll('.badge.eq').length === 2`, 'both shown as equipped');
  await a.shot('shop-inventory');
  await a.click('[data-item="hat:hood"]'); await a.click('[data-equip]');
  for (let i = 0; i < 100 && me().avatar.hat === 'hood'; i++) await wait(30);
  assert.notEqual(me().avatar.hat, 'hood');
  await a.click('[data-item="hat:hood"]'); await a.click('[data-equip]');
  for (let i = 0; i < 100 && me().avatar.hat !== 'hood'; i++) await wait(30);
  ok('Inventory equips/unequips purchases on the character and the house; the TV updates');

  // Refresh: gold, purchases and equipped items persist.
  const balance = 160 - hoodPrice;
  await a.send('Page.reload'); await wait(400);
  await a.until(`!document.querySelector('#screen-game').hidden && document.querySelector('#g-pouch') && Number(document.querySelector('#g-pouch b').textContent) === ${balance}`, 'gold after refresh');
  await a.click('#g-pouch'); await a.until(`document.querySelector('#g-pouch-pop .pouch-stats')`, 'pouch details');
  const stats = await a.eval(`[...document.querySelectorAll('#g-pouch-pop .pouch-stats b')].map((b) => Number(b.textContent))`);
  assert.deepEqual(stats, [balance, 300, 140 + hoodPrice], 'balance / earned / spent');
  await a.click('[data-open-shop]'); await a.until(`!document.querySelector('#screen-shop').hidden`, 'shop'); await a.click('[data-shop-tab="inventory"]');
  await a.until(`document.querySelectorAll('.badge.eq').length === 2`, 'equipped after refresh');
  ok('Refresh keeps gold (balance, earned, spent), inventory and equipped items');

  // Once the game starts the phone is purely the game: shop, look and house are closed (UI and server).
  await new Promise((r) => host.emit('host:action', { type: 'addBots', count: 5 }, r));
  await a.until(`!document.querySelector('#screen-shop').hidden`, 'shop still open before start');
  await new Promise((r) => host.emit('host:action', { type: 'start' }, r));
  await a.until(`!document.querySelector('#screen-game').hidden && document.querySelector('#screen-shop').hidden`, 'shop closes when the game starts');
  await a.frames();
  await a.until(`document.querySelector('#g-body [data-role]')`, 'the role card renders when the game starts');
  assert.deepEqual(a.errors, [], 'no errors rendering the game: ' + a.errors.join('\n'));
  assert.equal(await a.eval(`document.querySelectorAll('#g-body [data-open-shop], #g-body [data-edit], #g-body [data-house]').length`), 0, 'no look/house/shop buttons in the game');
  await a.eval(`document.querySelector('#g-pouch-pop').hidden && document.querySelector('#g-pouch').click()`);
  await a.until(`!document.querySelector('#g-pouch-pop').hidden && document.querySelector('#g-pouch-pop [data-shop-closed]')`, 'pouch popover shows the shop closed');
  assert(await a.eval(`!!document.querySelector('#g-pouch-pop [data-shop-closed]') && !document.querySelector('#g-pouch-pop [data-open-shop]')`), 'pouch shows the shop as closed');
  const refused = await a.eval(`new Promise((done) => { const s = io(); const c = JSON.parse(localStorage.getItem('mt.profile')); s.emit('profile:resume', c, () => s.emit('profile:buy', { itemId: 'hat:helmet' }, (r1) => s.emit('profile:equip', { itemId: 'hat:hood', on: false }, (r2) => s.emit('profile:avatar', { avatar: { hat: 'none' } }, (r3) => { s.close(); done([r1, r2, r3]); })))); })`);
  for (const r of refused) { assert.equal(r.ok, false); assert.match(r.error, /reopen after this game/); }
  assert.equal(me().avatar.hat, 'hood', 'nothing changed mid-game');
  await a.shot('game-no-shop');
  ok('After the game starts: shop/look/house closed on the phone, and the server refuses buy, equip and look changes');

  assert.deepEqual(a.errors, [], 'page errors: ' + a.errors.join('\n'));
  ok('No page errors');
  console.log(`All ${passed} shop end-to-end checks passed. Screenshots: ${SHOTS}`);
  host.close();
})().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => { cleanup(); setTimeout(() => process.exit(), 300).unref(); });
