'use strict';
// End-to-end check of the phone character creator in real headless Chrome
// (DevTools protocol, no extra dependencies). Not part of `npm test` because it
// needs Chrome; run with `npm run test:e2e`. Set CHROME=path if Chrome is elsewhere.
//
// Covers: joining as a new player, every option in every tab updating the live
// preview, randomize, revert (preview before saving), Save & join, refresh,
// a second player, rejoining another room, "Save look" without joining, the
// server-profile restore, and no horizontal overflow at phone width.
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { io } = require('socket.io-client');
const { CHROME, Browser, startServer, cleanup, wait } = require('./cdp');

const PORT = 3994, URL = `http://localhost:${PORT}`;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'mt-e2e');
if (!CHROME) { console.log('SKIP e2e-creator: Chrome not found (set CHROME=path).'); process.exit(0); }
let passed = 0;
const ok = (name) => { passed++; console.log(`  ✓ ${name}`); };

(async () => {
  await startServer(PORT);
  const host = io(URL, { transports: ['websocket'] }); let tv = null; host.on('host:state', (s) => { tv = s; });
  const hostEmit = (ev, d = {}) => new Promise((r) => host.emit(ev, d, r));
  const room = await hostEmit('host:create');

  const browser = new Browser({ shots: SHOTS }); await browser.launch();
  const a = await browser.page();

  // --- Join as a new player: the room link opens the creator directly.
  await a.go(`${URL}/play?room=${room.code}`);
  await a.until(`!document.querySelector('#screen-creator').hidden && !document.querySelector('#j-go').disabled && document.querySelector('#preview').dataset.look`, 'creator opens for a new player');
  assert(await a.noOverflow(), 'creator overflows phone width');
  const first = await a.look();
  ok('New player lands on the creator with a live preview and no horizontal overflow');

  // --- Every option in every tab updates the live preview immediately.
  const tabs = await a.eval(`[...document.querySelectorAll('[data-tab]')].map((b) => b.dataset.tab)`);
  assert.deepEqual(tabs, ['body', 'face', 'hair', 'clothes', 'accessories']);
  let tested = 0;
  for (const tab of tabs) {
    await a.click(`[data-tab="${tab}"]`);
    await a.until(`document.querySelector('[data-tab="${tab}"]').classList.contains('sel')`, 'tab ' + tab);
    await a.until(`[...document.querySelectorAll('.cas-tile canvas')].every((c) => c.width > 0)`, 'tiles painted in ' + tab);
    assert(await a.noOverflow(), 'overflow on tab ' + tab);
    await a.shot('creator-' + tab);
    const options = await a.eval(`[...document.querySelectorAll('#c-panel [data-field]')].map((b) => [b.dataset.field, b.dataset.value])`);
    assert(options.length > 0, 'no options in ' + tab);
    for (const [field, value] of options) {
      const sel = `#c-panel [data-field="${field}"][data-value="${value}"]`;
      await a.click(sel);
      await a.until(`(() => { const keys = Object.keys(MT_OPTIONS.AVATAR_FIELDS), v = JSON.parse(document.querySelector('#preview').dataset.look); return v[keys.indexOf(${JSON.stringify(field)})] === ${JSON.stringify(value)}; })()`, `preview shows ${field}=${value}`);
      assert(await a.eval(`document.querySelector(${JSON.stringify(sel)}).classList.contains('sel')`), `${field}=${value} not marked selected`);
      tested++;
    }
  }
  ok(`All ${tested} visible options across ${tabs.length} tabs update the live preview and selection`);

  // --- Preview before saving: draft is marked unsaved and Revert restores the saved look.
  assert(await a.eval(`!document.querySelector('#c-dirty').hidden && !document.querySelector('#c-revert').disabled`));
  await a.click('#c-revert');
  await a.until(`document.querySelector('#c-dirty').hidden`, 'revert clears unsaved badge');
  assert.deepEqual(await a.look(), first);
  ok('Changes stay a preview (Unsaved badge) and Revert restores the saved look');

  // --- Randomize keeps working and only touches character fields.
  await a.click('#random-character'); await a.until(`!document.querySelector('#c-dirty').hidden`, 'randomize changes the draft');
  const rnd = await a.look(); assert.notDeepEqual(rnd, first);
  ok('Randomize changes the character as a draft');

  // --- Build a specific look, name it, Save & join.
  const want = { expression: 'wink', hair: 'mohawk', outfit: 'jacket', color: '#9b59b6', hat: 'cap' }; // free items (most are earned now)
  for (const [tab, field] of [['face', 'expression'], ['hair', 'hair'], ['clothes', 'outfit'], ['clothes', 'color'], ['accessories', 'hat']]) {
    await a.click(`[data-tab="${tab}"]`); await a.click(`#c-panel [data-field="${field}"][data-value="${want[field]}"]`);
  }
  await a.eval(`(() => { const n = document.querySelector('#j-name'); n.value = 'Ana'; n.dispatchEvent(new Event('input')); })()`);
  await a.click('#j-go');
  const ana = () => tv && tv.players.find((p) => p.name === 'Ana');
  for (let i = 0; i < 100 && !ana(); i++) await wait(30);
  for (const [k, v] of Object.entries(want)) assert.equal(ana().avatar[k], v, 'TV shows ' + k);
  ok('Save & join: the TV receives exactly the customized look');

  // --- Joining continues to claiming a house; design it (every option previews), then move in.
  await a.until(`!document.querySelector('#screen-home').hidden && document.querySelector('#h-preview').dataset.look`, 'claim-your-house screen after joining');
  assert.equal(await a.eval(`document.querySelector('#h-title').textContent`), 'Claim your house');
  assert(await a.eval(`document.querySelector('#h-claims .claim.sel').textContent.includes('My own house')`));
  const homeLook = () => a.eval(`(() => { const keys = Object.keys(MT_OPTIONS.HOME_FIELDS), v = JSON.parse(document.querySelector('#h-preview').dataset.look || '[]'); return Object.fromEntries(keys.map((k, i) => [k, v[i]])); })()`);
  let homeTested = 0;
  for (const tab of await a.eval(`[...document.querySelectorAll('#h-tabs [data-tab]')].map((b) => b.dataset.tab)`)) {
    await a.click(`#h-tabs [data-tab="${tab}"]`);
    await a.until(`[...document.querySelectorAll('#h-panel .cas-tile canvas')].every((c) => c.width > 0)`, 'house tiles ' + tab);
    assert(await a.noOverflow(), 'house screen overflow ' + tab); await a.shot('house-' + tab);
    for (const [field, value] of await a.eval(`[...document.querySelectorAll('#h-panel [data-field]')].map((b) => [b.dataset.field, b.dataset.value])`)) {
      await a.click(`#h-panel [data-field="${field}"][data-value="${value}"]`);
      await a.until(`(() => { const keys = Object.keys(MT_OPTIONS.HOME_FIELDS), v = JSON.parse(document.querySelector('#h-preview').dataset.look); return v[keys.indexOf(${JSON.stringify(field)})] === ${JSON.stringify(value)}; })()`, `house preview ${field}=${value}`);
      homeTested++;
    }
  }
  const wantHome = { style: 'bakery', wall: '#d39a55', roof: '#2f4f80', door: 'round', windows: 'shuttered', yard: 'flowerbed' };
  for (const [tab, field] of [['style', 'style'], ['paint', 'wall'], ['paint', 'roof'], ['door', 'door'], ['door', 'windows'], ['yard', 'yard']]) { await a.click(`#h-tabs [data-tab="${tab}"]`); await a.click(`#h-panel [data-field="${field}"][data-value="${wantHome[field]}"]`); }
  assert(await a.eval(`!document.querySelector('#h-dirty').hidden`));
  await a.click('#h-save');
  await a.until(`!document.querySelector('#screen-game').hidden && document.querySelector('[data-home-status]')`, 'back in lobby after moving in');
  for (let i = 0; i < 100 && ana().homeLook.door !== 'round'; i++) await wait(30);
  for (const [k, v] of Object.entries(wantHome)) assert.equal(ana().homeLook[k], v, 'TV house ' + k);
  ok(`House screen after joining: ${homeTested} house options preview live; Move in saves the design to the TV`);

  // --- Refresh: same seat, and editing opens the saved look (not a stale draft).
  await a.send('Page.reload'); await wait(300);
  await a.until(`!document.querySelector('#screen-game').hidden && document.querySelector('[data-edit]')`, 'resumed after refresh');
  await a.click('[data-edit]');
  await a.until(`!document.querySelector('#screen-creator').hidden && document.querySelector('#preview').dataset.look`, 'edit opens creator');
  const reloaded = await a.look(); for (const [k, v] of Object.entries(want)) assert.equal(reloaded[k], v, 'after refresh ' + k);
  assert(await a.eval(`document.querySelector('#c-dirty').hidden && document.querySelector('#j-go').textContent === 'Save'`));
  // Edit in the lobby: change expression and save; the TV updates.
  await a.click('[data-tab="face"]'); await a.click('#c-panel [data-field="expression"][data-value="grin"]'); await a.click('#j-go');
  for (let i = 0; i < 100 && ana().avatar.expression !== 'grin'; i++) await wait(30);
  assert.equal(ana().avatar.expression, 'grin'); want.expression = 'grin';
  ok('Refresh keeps the saved look; lobby edits save and reach the TV');

  // --- A second player sees/gets their own look; both are correct on the TV.
  const b = await browser.page();
  await b.go(`${URL}/play?room=${room.code}`);
  await b.until(`!document.querySelector('#screen-creator').hidden && !document.querySelector('#j-go').disabled`, 'second player creator');
  await b.click('[data-tab="face"]'); await b.click('#c-panel [data-field="expression"][data-value="sad"]');
  await b.eval(`document.querySelector('#j-name').value = 'Ben'`); await b.click('#j-go');
  const ben = () => tv && tv.players.find((p) => p.name === 'Ben');
  for (let i = 0; i < 100 && !ben(); i++) await wait(30);
  assert.equal(ben().avatar.expression, 'sad'); assert.equal(ana().avatar.expression, 'grin');
  ok('A second player joins with their own look; both appear correctly to others');

  // --- Ben designs his own house independently, then moves in with Ana instead.
  await b.until(`!document.querySelector('#screen-home').hidden && document.querySelector('#h-preview').dataset.look`, 'Ben claim screen');
  await b.click('#h-tabs [data-tab="style"]'); await b.click('#h-panel [data-field="style"][data-value="tavern"]'); await b.click('#h-save');
  for (let i = 0; i < 100 && ben().homeLook.style !== 'tavern'; i++) await wait(30);
  assert.equal(ben().homeLook.style, 'tavern'); assert.equal(ana().homeLook.style, 'bakery', 'houses are customized separately');
  await b.until(`!document.querySelector('#screen-game').hidden && document.querySelector('[data-house]')`, 'Ben lobby');
  await b.click('[data-house]'); await b.until(`!document.querySelector('#screen-home').hidden && [...document.querySelectorAll('#h-claims .claim')].some((c) => c.textContent.includes('live with Ana'))`, 'move-in option');
  // Asking sends Ana a 20-second yes/no; Ben waits, nothing moves yet.
  const askAna = () => b.eval(`[...document.querySelectorAll('#h-claims .claim')].find((c) => c.textContent.includes('live with Ana')).click()`);
  await askAna();
  await a.until(`!document.querySelector('#move-ask').hidden && document.querySelector('#move-ask').textContent.includes('Ben wants to move in') && /\\d+s to answer/.test(document.querySelector('#move-ask').textContent)`, "Ana gets Ben's request");
  await b.until(`!document.querySelector('#h-move-status').hidden && document.querySelector('#h-move-status').textContent.includes('Asked Ana')`, 'Ben sees he is waiting');
  assert.equal(ben().livesWith, null, 'not moved before Ana answers');
  await a.shot('move-ask');
  await a.click('[data-move-no]');
  await b.until(`document.querySelector('#h-move-status').textContent.includes('no thanks')`, 'Ben sees the decline');
  await a.until(`document.querySelector('#move-ask').hidden`, 'request card closes'); assert.equal(ben().livesWith, null);
  await askAna(); await a.until(`!document.querySelector('#move-ask').hidden`, 'second request'); await a.click('[data-move-yes]');
  for (let i = 0; i < 100 && ben().livesWith !== ana().id; i++) await wait(30);
  await b.until(`document.querySelector('#h-move-status').textContent.includes('said yes')`, 'Ben sees the yes');
  assert.equal(ben().livesWith, ana().id); assert.equal(ben().home, ana().house);
  await b.until(`document.querySelector('#h-where').textContent.includes("staying at Ana's house")`, 'Ben sees he is staying with Ana');
  await b.click('#h-back');
  await a.until(`document.querySelector('[data-home-status]').textContent.includes('with Ben')`, "Ana's lobby shows Ben as a resident");
  ok('Moving in with another player: residency reaches the TV and both phones; designs stay separate');

  // --- The TV shows each house with a sign naming the owner and residents.
  const tvPage = await browser.page();
  await tvPage.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await tvPage.go(`${URL}/`);
  await tvPage.click('#create');
  await tvPage.until(`/^[A-Z]{4}$/.test(document.querySelector('#room-code').textContent.trim())`, 'TV room code');
  const tvCode = await tvPage.eval(`document.querySelector('#room-code').textContent.trim()`);
  const signText = await tvPage.eval(`(() => { const W = MT_WORLD; const owner = { id: 'a', name: 'Ana', house: 0 }; return W.signLines(owner, [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Ben' }, { id: 'c', name: 'Cy' }]); })()`);
  assert.deepEqual(signText, ['1 · Ana', '+ Ben, Cy']);
  const guests = [];
  for (const [name, style] of [['Owner', 'manor'], ['Guest', 'cottage'], ['Solo', 'tavern']]) {
    const s = io(URL, { transports: ['websocket'] }); guests.push(s);
    const r = await new Promise((res) => s.emit('player:join', { code: tvCode, name, home: { style, door: 'arched', yard: 'mailbox' } }, res)); assert(r.ok);
    s.playerId = r.playerId;
  }
  await new Promise((res) => guests[1].emit('player:home', { claim: { with: guests[0].playerId } }, res));
  await wait(1500); await tvPage.shot('tv-signs');
  guests.forEach((s) => s.close());
  ok('TV town renders owned houses with resident signs (screenshot saved)');

  // --- Leave and rejoin a different room with the same phone: saved look is the starting point.
  const room2 = await hostEmit('host:create');
  await a.go(`${URL}/play?room=${room2.code}`);
  await a.until(`!document.querySelector('#screen-creator').hidden && document.querySelector('#preview').dataset.look`, 'rejoin creator');
  const rejoin = await a.look(); for (const [k, v] of Object.entries(want)) assert.equal(rejoin[k], v, 'rejoin ' + k);
  assert.equal(await a.eval(`JSON.parse(localStorage.getItem('mt.home')).door`), 'round', 'house design saved on the device');
  // "Save look" persists without joining.
  await a.click('[data-tab="face"]'); await a.click('#c-panel [data-field="expression"][data-value="smirk"]'); await a.click('#c-save');
  await a.until(`document.querySelector('#c-dirty').hidden`, 'save look clears badge');
  // The server profile also restores the look when this device's saved copy is gone.
  await a.eval(`localStorage.removeItem('mt.avatar')`);
  await a.go(`${URL}/play?room=${room2.code}`);
  await a.until(`!document.querySelector('#screen-creator').hidden && !document.querySelector('#j-go').disabled && JSON.parse(document.querySelector('#preview').dataset.look || '[]').includes('smirk')`, 'profile restores look');
  const restored = await a.look(); assert.equal(restored.expression, 'smirk'); assert.equal(restored.hair, 'mohawk');
  await a.shot('creator-rejoin');
  ok('Rejoining starts from the saved look; Save look persists; the server profile restores it');

  // --- The /test bench's auto-join phones skip the creator and join with their saved look.
  const t = await browser.page();
  await t.go(`${URL}/play?room=${room2.code}&slot=t1&autojoin=1&name=${encodeURIComponent('Tester 1')}`);
  await t.until(`!document.querySelector('#screen-game').hidden`, 'autojoin phone joins');
  for (let i = 0; i < 100 && !(tv && tv.players.some((p) => p.name === 'Tester 1')); i++) await wait(30);
  assert(tv.players.some((p) => p.name === 'Tester 1'), 'autojoin player on TV');
  ok('/test auto-join phones still join directly');

  // --- Rejoining with the same phone brings the saved house design (device copy cleared -> server profile).
  await a.eval(`localStorage.removeItem('mt.home')`);
  await a.go(`${URL}/play?room=${room2.code}`);
  await a.until(`!document.querySelector('#screen-creator').hidden && !document.querySelector('#j-go').disabled`, 'creator for house rejoin');
  await a.eval(`document.querySelector('#j-name').value = 'Ana'`); await a.click('#j-go');
  await a.until(`!document.querySelector('#screen-home').hidden && document.querySelector('#h-preview').dataset.look`, 'claim screen in room 2');
  const homeAgain = await homeLook(); for (const [k, v] of Object.entries(wantHome)) assert.equal(homeAgain[k], v, 'house restored ' + k);
  ok('House design persists across rooms, including restore from the server profile');

  // --- RSP Supply theme: switching the room re-themes the phone menus and house preview live.
  await hostEmit('host:action', { type: 'settings', settings: { theme: 'rsp' } });
  await a.until(`document.documentElement.dataset.theme === 'rsp'`, 'phone receives the RSP theme');
  assert.equal(await a.eval(`getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()`), '#ffd21f');
  assert.equal(await a.eval(`getComputedStyle(document.documentElement).getPropertyValue('--wood').trim()`), '#1f4fa8');
  await wait(400); await a.shot('rsp-phone-house');
  await hostEmit('host:action', { type: 'settings', settings: { theme: 'medieval' } });
  await a.until(`document.documentElement.dataset.theme === 'medieval'`, 'phone returns to the original theme');
  assert.notEqual(await a.eval(`getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()`), '#ffd21f');
  await tvPage.eval(`document.documentElement.dataset.theme = 'rsp'`); await wait(300); await tvPage.shot('rsp-tv-menu');
  ok('RSP Supply theme re-themes phone menus live and switches back cleanly');

  const errors = [...a.errors, ...b.errors, ...t.errors, ...tvPage.errors];
  assert.deepEqual(errors, [], 'page errors: ' + errors.join('\n'));
  ok('No page errors');
  console.log(`All ${passed} creator end-to-end checks passed. Screenshots: ${SHOTS}`);
  host.close();
})().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => { cleanup(); setTimeout(() => process.exit(), 300).unref(); });
