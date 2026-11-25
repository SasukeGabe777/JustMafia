'use strict';
// JustZombies on a touch phone: REAL taps (Input.dispatchTouchEvent on an iPhone-sized, touch-emulated, mobile-UA
// page) reach every phone panel: the class wheel (and a swipe spins it), the level-up cards, the shop's buy
// button, the helper panel, the build panel, the helipad map picker and the canvas OPEN button for a chest.
// Each tap must land on the control itself (nothing covering it, no pointer-events: none from a TV rule).
//   node tools/e2e-trash-touch.js        (headless, muted; its own server on port 3986)
const assert = require('node:assert/strict');
const path = require('node:path');
const { Browser, startServer, cleanup, wait } = require('./cdp');
const PORT = Number(process.env.PORT) || 3986, URL = `http://localhost:${PORT}`;
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
let passed = 0; const ok = (m) => { passed++; console.log('  ✓ ' + m); };
const D = (js) => `(async () => { const T = window.TZ_DEBUG; ${js} })()`;
async function phone(browser, w, h) {
  const ph = await browser.page();
  await ph.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 3, mobile: true });
  await ph.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await ph.send('Emulation.setUserAgentOverride', { userAgent: UA, platform: 'iPhone' });
  return ph;
}
// a real finger tap at the middle of an element; returns what was under the finger
async function tapAt(ph, x, y) {
  await ph.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }] });
  await wait(40);
  await ph.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await wait(120);
}
async function tap(ph, sel, what) {
  const r = await ph.eval(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; el.scrollIntoView({ block: 'center', inline: 'center' }); const b = el.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2, top = document.elementFromPoint(x, y);
    window.__tapped = 0; el.addEventListener('click', () => { window.__tapped++; }, { once: true }); const ov = document.querySelector('.tz-ov'); return { x, y, hit: !!top && (top === el || el.contains(top)), top: (top ? top.className || top.tagName : '') + ' @' + Math.round(x) + ',' + Math.round(y) + ' ov=' + (ov ? ov.hidden + '/' + ov.className + '/' + getComputedStyle(ov).display + '/' + getComputedStyle(ov).pointerEvents : '-') + ' el=' + getComputedStyle(el).pointerEvents + '/' + getComputedStyle(el).visibility }; })()`);
  assert(r, what + ': ' + sel + ' is on screen'); assert(r.hit, what + ': nothing covers it (under the finger: ' + r.top + ')');
  await tapAt(ph, r.x, r.y);
  return r;
}
async function swipe(ph, sel, dx) {
  const r = await ph.eval(`(() => { const b = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
  await ph.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x, y: r.y, id: 2 }] });
  for (let i = 1; i <= 6; i++) { await ph.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: r.x + (dx * i) / 6, y: r.y, id: 2 }] }); await wait(16); }
  await ph.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait(900);
}
(async () => {
  process.chdir(path.join(__dirname, '..'));
  await startServer(PORT);
  const browser = new Browser({ debugPort: Number(process.env.DEBUG_PORT) || 9366 }); await browser.launch();
  try {
    const tv = await browser.page(); await tv.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await tv.go(`${URL}/box/tv?game=trash&new=1&practice=0`); await tv.until(`/^[A-Z]{4}$/.test((document.querySelector('#code') || {}).textContent || '')`, 'lobby');
    const code = await tv.eval(`document.querySelector('#code').textContent`);
    for (const [k, v] of [['mode', 'garage'], ['diff', 'chill']]) { await tv.eval(`(() => { const s = document.querySelector('[data-set="${k}"]'); s.value = '${v}'; s.onchange(); return true; })()`); await wait(250); }
    const ph = await phone(browser, 844, 390);
    await ph.go(`${URL}/j/${code}`); await ph.until(`!document.querySelector('#join').hidden`, 'join'); await ph.eval(`document.querySelector('#j-name').value = 'Tia'`);
    await tap(ph, '#j-go', 'join'); await ph.until(`/You’re in/.test(document.body.textContent)`, 'phone lobby');
    await tv.click('#start');
    try { await tv.until(`!!document.querySelector('#show-skip')`, 'intro', 5000); for (let i = 0; i < 4; i++) { await tv.eval(`(document.querySelector('#show-skip') || {}).click && document.querySelector('#show-skip').click(); true`); await wait(400); } } catch { /* no intro */ }
    await ph.until(`!!window.TZ_DEBUG && !!TZ_DEBUG.sim()`, 'sim', 15000); await ph.eval(D(`T.skip(); return true;`));
    await ph.until(`!!document.querySelector('.jz-go')`, 'the class wheel', 8000); await wait(500);
    assert(await ph.eval(`navigator.maxTouchPoints > 0 && /iPhone/.test(navigator.userAgent)`), 'an emulated iPhone');
    // the class wheel: a swipe spins it to another class; a tap on PLAY AS picks it
    const i0 = await ph.eval(`TZ_DEBUG.wheel().index()`); await swipe(ph, '.jz-rim', -260); const i1 = await ph.eval(`TZ_DEBUG.wheel().index()`);
    assert.notEqual(i1, i0, 'a swipe spins the wheel'); ok('class wheel: a touch swipe spins it (' + i0 + ' -> ' + i1 + ')');
    await swipe(ph, '.jz-rim', 260); await tap(ph, '.jz-arrow.r', 'the wheel arrow'); await wait(500);
    const locked = await ph.eval(`TZ_DEBUG.wheel().item().locked`); if (locked) { await tap(ph, '.jz-arrow.l', 'the wheel arrow'); await wait(500); }
    await tap(ph, '.jz-go', 'PLAY AS'); await ph.until(`!!TZ_DEBUG.sim().cls`, 'class picked', 3000);
    assert.equal(await ph.eval(`TZ_DEBUG.overlay()`), '', 'the wheel closed'); ok('class wheel: a real tap on PLAY AS picks the class and closes it');
    await ph.eval(D(`T.god(true); T.clear(); return true;`)); await wait(300);
    // iPhone: the ⛶ button shows a small, dismissible Add-to-Home-Screen tip (no Fullscreen API there); the game fills the screen
    await tap(ph, '.tz-fs', 'full screen'); await ph.until(`!!document.querySelector('.tz-iostip')`, 'the iPhone tip', 2000); await ph.shot('touch-iphone-tip');
    const fill = await ph.eval(`(() => { const r = document.querySelector('.tz-root').getBoundingClientRect(); return [r.width, r.height, innerWidth, innerHeight, document.scrollingElement.scrollHeight <= innerHeight + 1]; })()`); assert(fill[0] >= fill[2] - 1 && fill[1] >= fill[3] - 1 && fill[4], 'the game fills the screen, no page scroll: ' + fill);
    await tap(ph, '.tz-iostip button', 'tip close'); await wait(200); assert(!(await ph.eval(`!!document.querySelector('.tz-iostip')`)), 'dismissed'); ok('iPhone: the full-screen button shows a small one-time tip (dismissible); the game fills the visible screen with no page scroll');
    // level-up cards
    await ph.eval(D(`T.xp(400); return true;`)); await ph.until(`!!document.querySelector('.tz-ov:not([hidden]) [data-card]')`, 'level-up cards', 4000); await wait(300);
    const lv0 = await ph.eval(`TZ_DEBUG.sim().pendingLevels`);
    await tap(ph, '.tz-ov:not([hidden]) [data-card="0"]', 'level-up card'); await wait(300);
    assert(await ph.eval(`window.__tapped === 1`), 'the card got the tap');
    const lv1 = await ph.eval(`TZ_DEBUG.sim().pendingLevels`); assert(lv1 < lv0 || lv1 === 0, 'a level was spent: ' + lv0 + ' -> ' + lv1);
    for (let i = 0; i < 12 && (await ph.eval(`!!document.querySelector('.tz-ov:not([hidden]) [data-card]')`)); i++) await tap(ph, '.tz-ov:not([hidden]) [data-card="0"]', 'level-up card');
    assert.equal(await ph.eval(`TZ_DEBUG.overlay()`), '', 'cards closed'); ok('level-up cards: a real tap picks a card and the overlay closes');
    // the shop: buy something
    await ph.eval(D(`T.cash(2000); return true;`)); await ph.eval(D(`return T.jump('market');`)); await wait(400); let sh = ''; for (let i = 0; i < 6 && sh !== 'shop'; i++) { sh = await ph.eval(D(`return T.shop();`)); await wait(300); } assert.equal(sh, 'shop', 'the market opened');
    await ph.until(`!!document.querySelector('.tz-ov:not([hidden]) [data-buy]:not([disabled])')`, 'buy buttons', 4000); const cash0 = await ph.eval(`TZ_DEBUG.sim().cash`);
    await tap(ph, '.tz-ov:not([hidden]) [data-buy]:not([disabled])', 'shop buy'); await wait(300); assert(await ph.eval(`window.__tapped === 1`), 'buy got the tap');
    assert((await ph.eval(`TZ_DEBUG.sim().cash`)) < cash0, 'cash was spent'); ok('shop: a real tap on a buy button buys it');
    await tap(ph, '[data-close]', 'shop close'); await wait(300);
    // the loadout: a new gun with no free slot offers a swap; tap a part to swap it out; then drop a part (two taps)
    await ph.eval(D(`const s = T.sim(); s.weapons.length = 0; s.ab.mount = 0; s.stats(); s.addWeapon('launcher'); s.banner = null; return s.addWeapon('coil');`)); await ph.until(`!!document.querySelector('.tz-ov:not([hidden]) [data-swap]')`, 'the swap offer', 4000); await wait(300);
    await tap(ph, '.tz-ov:not([hidden]) [data-swap]', 'swap'); await wait(300); assert.equal(await ph.eval(`TZ_DEBUG.sim().weapons.map((w) => w.id).join()`), 'coil', 'swapped in by a tap');
    await tap(ph, '.tz-ov:not([hidden]) [data-drop]', 'drop (arm)'); await tap(ph, '.tz-ov:not([hidden]) [data-drop]', 'drop'); await wait(300); assert.equal(await ph.eval(`TZ_DEBUG.sim().weapons.length`), 0, 'dropped by two taps');
    await tap(ph, '.tz-ov:not([hidden]) [data-close]', 'done'); await wait(300); ok('loadout: real taps swap a part for a new gun and drop a part');
    // the chest OPEN button (drawn on the canvas)
    await ph.eval(D(`const s = T.sim(); window.__chest = 0; s.chestNear = () => ({ x: s.p.x + 40, y: s.p.y, kind: 'loot' }); s.openChest = () => { window.__chest++; return true; }; return true;`)); await wait(300);
    const cb = await ph.eval(`(TZ_DEBUG.btns() || []).find((b) => b.id === 'chest')`); assert(cb, 'an OPEN button'); await tapAt(ph, cb.x, cb.y);
    assert.equal(await ph.eval(`window.__chest`), 1, 'the OPEN button got the tap'); ok('chest: a real tap on the canvas OPEN button opens it');
    await ph.eval(D(`const s = T.sim(); delete s.chestNear; delete s.openChest; return true;`));
    // the helipad map picker
    const pk = await ph.eval(D(`const s = T.sim(), P = TZX.helipads(s.seed)[0]; s.enterArea(P[0], P[1], null); s.z.length = 0; s.cleared = true; T.atPad(); s.heliAt = 0; return T.heliUi();`)); assert.equal(pk, 'heli', 'the picker opened');
    await wait(400); const home = await ph.eval(`(TZ_DEBUG.view().explored || []).map((q) => q[0] + ',' + q[1]).find((k) => k !== TZ_DEBUG.sim().cell.join(','))`); assert(home, 'an explored block');
    const xy = await ph.eval(`(() => { const c = document.querySelector('.tz-tmc'), [hx, hy] = ${JSON.stringify(home)}.split(',').map(Number), N = TZW.GRID, wv = c.clientWidth, hv = c.clientHeight, cw = Math.min((wv - 20) / N, ((hv - 20) / N) * (TZW.AW / TZW.AH)), ch = cw * (TZW.AH / TZW.AW), r = c.getBoundingClientRect(); return { x: r.left + (wv - cw * N) / 2 + (hx + 0.5) * cw, y: r.top + (hv - ch * N) / 2 + (hy + 0.5) * ch }; })()`);
    await tapAt(ph, xy.x, xy.y); assert(await ph.eval(`!document.querySelector('[data-fly]').disabled && /Fly to/.test(document.querySelector('[data-pick]').textContent)`), 'tapping a block picks it');
    await tap(ph, '[data-fly]', 'Fly'); await wait(500); assert.notEqual(await ph.eval(`TZ_DEBUG.overlay()`), 'heli', 'Fly closed the picker'); ok('helipad picker: a real tap picks a block on the map and FLY asks the pilot');
    await ph.until(`!TZ_DEBUG.sim().heli`, 'any flight over', 9000);
    // the build panel (Garage Defense)
    await ph.eval(D(`T.garage('build', 1); T.cash(2000); return T.buildUi();`)); await ph.until(`!!document.querySelector('.tz-ov.build button:not([disabled]):not([data-close])')`, 'build panel', 4000);
    await tap(ph, '.tz-ov.build button:not([disabled]):not([data-close])', 'build'); assert(await ph.eval(`window.__tapped === 1`), 'the build button got the tap'); ok('build panel: a real tap reaches its buttons');
    await ph.eval(`(() => { const b = document.querySelector('[data-close]'); if (b) b.click(); return true; })()`); await wait(300);
    // the helper panel (you're down / out)
    await ph.eval(D(`T.god(false); T.kill(); return true;`)); await wait(1500); await ph.eval(D(`return T.helperUi();`)); await ph.until(`!!document.querySelector('.tz-ov:not([hidden]) button:not([disabled])')`, 'helper panel', 8000);
    await tap(ph, '.tz-ov:not([hidden]) button:not([disabled])', 'helper'); assert(await ph.eval(`window.__tapped === 1`), 'the helper button got the tap'); ok('helper panel: a real tap reaches its buttons');
    const errs = ph.errors.concat(tv.errors); assert.equal(errs.length, 0, 'no page errors: ' + errs.join('\n'));
    ok('no page errors');
    console.log(`\nAll ${passed} JustZombies touch checks passed.`);
  } finally { cleanup(); }
  process.exit(0);
})().catch((e) => { console.error(e); cleanup(); process.exit(1); });
