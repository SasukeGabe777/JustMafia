'use strict';
// End-to-end check of Pets (docs/justgold.md "Pets"): the shop's Pets section (animated cards,
// buy, wear, take off) at phone and desktop widths, then the pet on your shoulder in a box game
// (TV lobby + phone, animated pictures) and on JustMafia's phone. Screenshots in SHOTS.
//   node tools/e2e-pets.js        (PORT 3302 by default; never the party server's 3000)
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { io } = require('socket.io-client');
const { CHROME, Browser, startServer, cleanup, wait } = require('./cdp');

const PORT = Number(process.env.PORT_PETS) || 3302, URL = `http://localhost:${PORT}`;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'mt-e2e');
if (!CHROME) { console.log('SKIP e2e-pets: Chrome not found (set CHROME=path).'); process.exit(0); }
let passed = 0;
const ok = (name) => { passed++; console.log(`  ✓ ${name}`); };
const PAGES = [];
const park = async () => { for (const p of PAGES) if (!p.parked) { p.parked = true; try { await p.send('Page.navigate', { url: 'about:blank' }); } catch { /* closed */ } } };

(async () => {
  await startServer(PORT, { MT_DEV_GRANTS: '1' });
  const browser = new Browser({ shots: SHOTS, debugPort: 9352 }); await browser.launch();

  // ---- the shop: a new character, some JustGold, the Pets section ----
  const a = await browser.page(); PAGES.push(a);
  await a.go(`${URL}/shop`);
  await a.until(`!document.querySelector('#start').hidden && document.querySelector('#s-go')`, 'shop start');
  await a.eval(`document.querySelector('#s-name').value = 'Pia'`); await a.click('#s-go');
  await a.until(`window.JG_SHOP && JG_SHOP.state().st && JG_SHOP.state().st.catalog`, 'shop loaded', 10000);
  const call = (ev, extra = '') => a.eval(`new Promise((done) => { const s = io('/box'); s.emit('${ev}', { auth: JSON.parse(localStorage.getItem('box.profile'))${extra} }, (r) => { s.close(); done(r); }); })`);
  const g = await call('dev:progress', ', gold: 1500');
  assert(g && g.ok !== false, 'test gold granted');
  await a.go(`${URL}/shop?tab=pets`);
  await a.until(`document.querySelectorAll('#shelf .grid.pets .card').length === 16`, '16 pet cards');
  const tabs = await a.eval(`[...document.querySelectorAll('#tabs [data-tab]')].map((b) => b.dataset.tab)`);
  assert(tabs.includes('pets'), 'a Pets tab'); assert(tabs.indexOf('pets') > tabs.indexOf('gear') && tabs.indexOf('pets') < tabs.indexOf('wardrobe'));
  const groups = await a.eval(`[...document.querySelectorAll('#shelf .grid.pets')].map((g) => [g.className.split(' ').pop(), g.children.length])`);
  assert.deepEqual(groups, [['r-common', 4], ['r-rare', 6], ['r-epic', 4], ['r-legendary', 2]]);
  // The cards animate: a pet card's pixels change from one moment to the next.
  const px = `(() => { const cv = document.querySelector('#shelf .card[data-item="pet:dragonling"] canvas'); return cv.toDataURL(); })()`;
  const f1 = await a.eval(px); await wait(700); const f2 = await a.eval(px);
  assert.notEqual(f1, f2, 'the pet card animates');
  assert(await a.noOverflow(), 'no sideways scroll at 390');
  await a.eval(`window.scrollTo(0, 0)`); await a.shot('pets-shop-390');
  ok(`Shop: a 🐾 Pets tab (${tabs.join(', ')}), 16 animated pets in Common 4 · Rare 6 · Epic 4 · Legendary 2`);

  // Try on, buy (it's worn right away), take off, wear again.
  await a.click('#shelf .card[data-item="pet:kitten"]');
  await a.until(`/Buy/.test(document.querySelector('#act').textContent)`, 'buy button');
  await wait(300); await a.shot('pets-shop-tryon-390');
  const before = await a.eval(`JG_SHOP.state().st.gold`);
  await a.click('#act [data-act="buy"]');
  await a.until(`JG_SHOP.state().st.look.pet === 'kitten'`, 'bought and worn');
  const st1 = await call('shop:state');
  assert.equal(st1.look.pet, 'kitten'); assert(st1.owned.includes('pet:kitten'));
  const kit = st1.catalog.find((i) => i.id === 'pet:kitten');
  assert.equal(kit.section, 'pets'); assert.equal(st1.gold, before - kit.cost);
  if (!(await a.eval(`JG_SHOP.state().sel === 'pet:kitten'`))) await a.click('#shelf .card[data-item="pet:kitten"]'); // still picked after buying
  await a.until(`document.querySelector('#act [data-act="off"]')`, 'take off button'); await a.click('#act [data-act="off"]');
  await a.until(`JG_SHOP.state().st.look.pet === 'none'`, 'took it off');
  if (!(await a.eval(`JG_SHOP.state().sel === 'pet:kitten'`))) await a.click('#shelf .card[data-item="pet:kitten"]'); await a.until(`document.querySelector('#act [data-act="wear"]')`, 'wear button');
  await a.click('#act [data-act="wear"]'); await a.until(`JG_SHOP.state().st.look.pet === 'kitten'`, 'worn again');
  // A second pet replaces the first (one at a time).
  await a.click('#shelf .card[data-item="pet:dragonling"]'); await a.until(`document.querySelector('#act [data-act="buy"]')`, 'buy dragon');
  await a.click('#act [data-act="buy"]'); await a.until(`JG_SHOP.state().st.look.pet === 'dragonling'`, 'dragon worn');
  await a.eval(`window.scrollTo(0, 0)`); await wait(300); await a.shot('pets-shop-worn-390');
  ok('Buy a pet (worn at once), take it off, wear it again; a second pet replaces the first');

  await a.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 760, deviceScaleFactor: 2, mobile: true });
  await a.go(`${URL}/shop?tab=pets`); await a.until(`document.querySelectorAll('#shelf .grid.pets .card').length === 16`, 'pets at 360');
  assert(await a.noOverflow(), 'no sideways scroll at 360'); await wait(300); await a.shot('pets-shop-360');
  await a.send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
  await a.go(`${URL}/shop?tab=pets`); await a.until(`document.querySelectorAll('#shelf .grid.pets .card').length === 16`, 'pets at 1366');
  await a.click('#shelf .card[data-item="pet:owl"]'); await wait(500);
  assert(await a.noOverflow(), 'no sideways scroll at 1366'); await a.shot('pets-shop-1366');
  await a.click('#tabs [data-tab="wardrobe"]'); await a.until(`/Pets/.test(document.querySelector('#shelf').textContent)`, 'wardrobe lists pets');
  assert.equal(await a.eval(`document.querySelectorAll('#shelf .card[data-item^="pet:"]').length`), 2);
  ok('Pets fit phones (360, 390) and desktop (1366); the wardrobe has a 🐾 Pets group');

  // ---- a box game: the TV lobby and the phone show the character with the pet, animated ----
  const tv = await browser.page(); PAGES.push(tv);
  await tv.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await tv.go(`${URL}/box/tv?game=likely&new=1&practice=0`);
  await tv.until(`/^[A-Z]{4}$/.test((document.querySelector('#code') || {}).textContent || '')`, 'box lobby');
  const code = await tv.eval(`document.querySelector('#code').textContent`);
  await a.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await a.go(`${URL}/j/${code}`);
  await a.until(`!document.querySelector('#join').hidden`, 'join screen');
  await a.eval(`document.querySelector('#j-name').value = 'Pia'`); await a.click('#j-go');
  await a.until(`!document.querySelector('#game').hidden && /You’re in/.test(document.body.textContent)`, 'phone in lobby');
  await tv.until(`document.querySelector('#roster img[data-pet]')`, 'TV roster: the character with a pet');
  await tv.click('#add-bots'); await tv.until(`document.querySelectorAll('#roster .chip').length >= 6`, 'bots');
  await tv.until(`document.querySelector('#roster img[data-pet]')`, 'still there after the bots');
  const src = `document.querySelector('#roster img[data-pet]').getAttribute('src')`;
  const s1 = await tv.eval(src); await wait(900); const s2 = await tv.eval(src);
  assert.notEqual(s1, s2, 'the TV picture animates (frames swap)');
  await a.until(`document.querySelector('.big-av img[data-pet]')`, 'phone lobby: big character with the pet');
  const p1 = await a.eval(`document.querySelector('.big-av img[data-pet]').getAttribute('src')`); await wait(900);
  assert.notEqual(p1, await a.eval(`document.querySelector('.big-av img[data-pet]').getAttribute('src')`), 'the phone picture animates');
  await tv.shot('pets-box-tv-lobby');
  await a.eval(`(() => { const b = [...document.querySelectorAll('button, a')].find((x) => x.textContent.trim() === 'Skip'); if (b) b.click(); return true; })()`); await wait(400); await a.shot('pets-box-phone');
  ok('Box game: the TV roster and the phone lobby show the pet, animated (one frame loop)');

  // ---- JustMafia: the phone character wears the pet ----
  const host = io(URL, { transports: ['websocket'] }); let town = null; host.on('host:state', (s) => { town = s; });
  const room = await new Promise((r) => host.emit('host:create', {}, r));
  await a.go(`${URL}/play?room=${room.code}`);
  await a.until(`!document.querySelector('#screen-creator').hidden && !document.querySelector('#j-go').disabled`, 'JustMafia creator');
  await a.eval(`document.querySelector('#j-name').value = 'Pia'`); await a.click('#j-go');
  await a.until(`!document.querySelector('#screen-home').hidden || !document.querySelector('#screen-game').hidden`, 'JustMafia next screen', 8000);
  if (await a.eval(`!document.querySelector('#screen-home').hidden && !!document.querySelector('#h-save')`)) { await a.click('#h-save'); await a.until(`!document.querySelector('#screen-game').hidden`, 'JustMafia lobby'); }
  // The town (the TV) gets the saved look with the pet: the account's pet is carried into JustMafia.
  const deadline = Date.now() + 6000; let pia = null;
  while (Date.now() < deadline && !(pia && pia.avatar && pia.avatar.pet === 'dragonling')) { pia = town && (town.players || []).find((p) => p.name === 'Pia'); await wait(100); }
  assert.equal(pia && pia.avatar && pia.avatar.pet, 'dragonling', 'JustMafia player wears the pet');
  await wait(400); await a.shot('pets-mafia-phone');
  // Edit your townsfolk: the creator stage animates the character with the pet.
  if (await a.eval(`!!document.querySelector('#g-body [data-edit]')`)) {
    await a.click('#g-body [data-edit]');
    await a.until(`!document.querySelector('#screen-creator').hidden`, 'edit creator');
    await a.until(`(() => { const l = document.querySelector('#preview').dataset.look; if (!l) return false; const k = Object.keys(MT_OPTIONS.AVATAR_FIELDS); return JSON.parse(l)[k.indexOf('pet')] === 'dragonling'; })()`, 'the creator draws the pet', 8000);
    await wait(300); await a.shot('pets-mafia-creator');
  }
  ok('JustMafia: the town gets the pet with the saved look; the phone draws it');

  for (const p of PAGES) assert.deepEqual(p.errors, [], 'no page errors');
  ok('no page errors');
  await park();
  console.log(`\nAll ${passed} pets e2e checks passed. Screenshots: ${SHOTS}`);
  host.close(); cleanup(); process.exit(0);
})().catch(async (e) => { console.error(e); try { await park(); } catch { /* */ } cleanup(); process.exit(1); });
