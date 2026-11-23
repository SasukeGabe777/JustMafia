'use strict';
// End-to-end: the JustGold chest (public/box/chest.js, box/room.js openChest) on real pages
// (headless, muted Chrome). One game: each phone opens its own chest (the signed-in one rolls its
// balance up, the guest gets "Save your stuff"), the TV shows everyone's chests in a row, the phone
// header and the main menu show the balance. Then a 2-game Party Mode: the host skips a chest, and
// the finale opens the legendary party chest on the TV and the phones.
//   node tools/e2e-chest.js            (PORT, DEBUG_PORT, SHOTS to change the defaults)
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { io } = require('socket.io-client');
const { CHROME, Browser, startServer, cleanup, wait } = require('./cdp');

const PORT = Number(process.env.PORT) || 3612, URL = `http://localhost:${PORT}`;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'mt-e2e-chest');
if (!CHROME) { console.log('SKIP e2e-chest: Chrome not found (set CHROME=path).'); process.exit(0); }
let passed = 0; const PAGES = [];
const ok = (name) => { passed++; console.log(`  ✓ ${name}`); };
// Viewport screenshots (the overlays are position: fixed; a full-page capture would misplace them).
const snap = async (p, name) => { const { data } = await p.send('Page.captureScreenshot', { format: 'png' }); require('node:fs').writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(data, 'base64')); };
// Headless Chrome only animates the front tab smoothly: bring the one being checked forward.
const front = (p) => p.send('Page.bringToFront').catch(() => {});
// Page loads get 30 s (busy machines).
const nav = async (p, url) => { await p.send('Page.navigate', { url }); await wait(400); await p.until('document.readyState === "complete"', 'load ' + url, 30000); };
const emit = (s, ev, msg) => new Promise((res) => s.emit(ev, msg, (r) => res(r)));

async function tvPage(browser, q) {
  const tv = await browser.page(); PAGES.push(tv); await tv.send('Page.bringToFront').catch(() => {});
  await tv.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await tv.send('Page.navigate', { url: `${URL}/box/tv?${q}` }); await wait(500);
  await tv.until(`/^[A-Z]{4}$/.test((document.querySelector('#code') || {}).textContent || '')`, 'TV lobby', 30000);
  const host = JSON.parse(await tv.eval(`localStorage.getItem('box.host')`));
  return { tv, code: host.code, hostKey: host.hostKey };
}
async function phonePage(browser, code, name, creds) {
  const ph = await browser.page(); PAGES.push(ph);
  await ph.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await nav(ph, `${URL}/box/play`); await ph.eval(`localStorage.setItem('box.tour', '1'); true`); // (no first-join tour over the screenshots)
  if (creds) await ph.eval(`localStorage.setItem('box.profile', ${JSON.stringify(JSON.stringify(creds.auth))}); localStorage.setItem('mt.profile', ${JSON.stringify(JSON.stringify(creds.wallet))}); true`);
  await nav(ph, `${URL}/j/${code}`);
  await ph.until(`!document.querySelector('#join').hidden && document.querySelector('#j-code').value === '${code}'`, 'join screen');
  await ph.eval(`document.querySelector('#j-name').value = ${JSON.stringify(name)}`); await ph.click('#j-go');
  await ph.until(`!document.querySelector('#game').hidden`, name + ' joined');
  return ph;
}
const join = (ph, code, name) => nav(ph, `${URL}/j/${code}`).then(() => ph.until(`!document.querySelector('#join').hidden || !document.querySelector('#game').hidden`, 'page')).then(async () => {
  if (await ph.eval(`!document.querySelector('#join').hidden`)) { await ph.eval(`document.querySelector('#j-name').value = ${JSON.stringify(name)}`); await ph.click('#j-go'); }
  await ph.until(`!document.querySelector('#game').hidden`, name + ' joined');
});
// Dismiss the first-join tour / sheets that may cover the phone.
const clearPhone = (ph) => ph.eval(`document.querySelectorAll('.tour, #tour, .jga-nudge').forEach((x) => x.remove()); true`);
async function finish(dev, room) {
  for (let i = 0; i < 40; i++) { const r = await emit(dev, 'dev:finish', room); if (r && r.ok) return; await wait(400); }
  throw new Error('the game did not finish');
}

(async () => {
  await startServer(PORT, { MT_DEV_GRANTS: '1' });
  // Two browsers: the TV in its own (always the front tab, so it animates), the phones in the other.
  const DBG = Number(process.env.DEBUG_PORT) || 9612;
  const tvBrowser = new Browser({ shots: SHOTS, debugPort: DBG }); await tvBrowser.launch();
  const browser = new Browser({ shots: SHOTS, debugPort: DBG + 1 }); await browser.launch();
  const dev = io(URL + '/box', { transports: ['websocket'], forceNew: true });
  await new Promise((r) => dev.once('connect', r));
  // Ana has an account with a wallet (as after opening the shop); Bo is a guest (no wallet yet).
  const acc = await emit(dev, 'profile:create', { name: 'Ana' }); assert(acc.ok);
  const auth = { id: acc.id, token: acc.token };
  const wal = await emit(dev, 'account:wallet', { auth }); assert(wal.ok && wal.wallet);
  const creds = { auth, wallet: wal.wallet };

  // ---------- one game: the chests ----------
  const A = await tvPage(tvBrowser, 'game=likely&new=1&practice=0');
  const ana = await phonePage(browser, A.code, 'Ana', creds), bo = await phonePage(browser, A.code, 'Bo', null);
  await A.tv.click('#add-bots'); await A.tv.until(`document.querySelectorAll('#roster .chip').length >= 7`, 'bots');
  await ana.until(`!!document.querySelector('#h-jg') && document.querySelector('#h-jg b').textContent === '0'`, 'the phone header shows the balance');
  await A.tv.click('#start'); await wait(600);
  await finish(dev, { code: A.code, hostKey: A.hostKey });
  await A.tv.until(`!!document.querySelector('.jgc-ov.jgc-tv') && document.querySelector('.jgc-ov.jgc-tv').style.visibility !== 'hidden'`, 'the TV chest row', 9000);
  assert.equal(await A.tv.eval(`document.querySelectorAll('.jgc-cell').length`), 2, 'a chest for each person, none for bots');
  assert(await A.tv.eval(`/Ana/.test(document.querySelector('.jgc-row').textContent) && /Bo/.test(document.querySelector('.jgc-row').textContent)`));
  assert(await A.tv.eval(`!!document.querySelector('.jgc-guestb')`), 'the guest’s chest says to save it');
  await wait(1300); await snap(A.tv, 'chest-tv-opening'); await wait(1500); await snap(A.tv, 'chest-tv');
  await ana.until(`!!document.querySelector('.jgc-ov.jgc-phone') && document.querySelector('.jgc-ov.jgc-phone').style.visibility !== 'hidden'`, 'Ana’s chest', 6000);
  await clearPhone(ana); await clearPhone(bo);
  await front(ana); await wait(600); await snap(ana, 'chest-phone-open');
  await front(ana); await ana.until(`!!(JGChest.last() && JGChest.last().where === 'phone')`, 'Ana’s chest finished', 9000);
  await snap(ana, 'chest-phone');
  const done = await ana.eval(`JGChest.last()`), total = done.n;
  assert(total >= 40, 'a first game of the day pays ' + total);
  assert(done.labels.some((l) => /First game today/.test(l)), 'the daily bonus line');
  assert(done.lines >= 2 && done.lines === done.labels.length, 'every line shown');
  const counted = done.count;
  const status = await emit(dev, 'account:status', { auth }); assert.equal(counted, status.gold, 'the counter rolls up to the new balance');
  assert(await ana.noOverflow(), 'no sideways scroll on the phone');
  await front(bo); await bo.until(`!!document.querySelector('[data-jgc-guest]')`, 'Bo’s chest asks him to save it', 9000);
  await wait(600); await snap(bo, 'chest-phone-guest');
  ok(`after a game: each phone opens its chest (Ana +${total} JG, counter ${counted}; Bo the guest is asked to save), the TV shows the row`);
  await ana.until(`!document.querySelector('.jgc-ov.jgc-phone')`, 'the chest closes by itself', 6000);
  await ana.until(`document.querySelector('#h-jg b').textContent === '${status.gold}'`, 'the header balance ticks up', 4000);
  await A.tv.until(`!document.querySelector('.jgc-ov.jgc-tv')`, 'the TV row closes by itself', 6000);
  await snap(ana, 'chest-phone-header');
  // Bo saves his stuff: the gold of the game he just played comes with him (box/room.js claimPending).
  await bo.click('[data-jgc-save]'); await bo.until(`!!document.querySelector('#jga-name') || !!document.querySelector('#jga-pw')`, 'the save form');
  await bo.eval(`document.querySelector('#jga-name').value = 'BoSaves'; document.querySelector('#jga-pw').value = 'gold rush 99'; document.querySelector('[data-form="save"] .jga-go').click(); true`);
  await bo.until(`!!document.querySelector('#h-jg') && !document.querySelector('#h-jg').classList.contains('unsaved') && Number(document.querySelector('#h-jg b').textContent) > 0`, 'Bo’s saved gold in his header', 8000);
  ok('the header balance ticks up after the chest; a guest who saves keeps the gold of the game he just played');
  // The main menu shows the signed-in host's balance.
  const hub = ana; await nav(hub, `${URL}/`); await hub.until(`!!document.querySelector('#hub-jg')`, 'hub balance');
  await hub.until(`document.querySelector('#hub-jg [data-jg]').textContent === '${status.gold}'`, 'hub balance number', 4000);
  await snap(hub, 'hub-balance-phone');
  ok('the main menu shows the JustGold of the account on this device');

  // ---------- Party Mode: skip a chest, then the legendary finale ----------
  const B = await tvPage(tvBrowser, 'game=likely&party=likely,spectrum&minutes=20&flow=auto&intros=skip&practice=off&new=1');
  await join(ana, B.code, 'Ana'); await join(bo, B.code, 'Bo');
  await B.tv.click('#add-bots'); await B.tv.until(`document.querySelectorAll('#roster .chip').length >= 7`, 'bots');
  await B.tv.click('#start'); await wait(600);
  await finish(dev, { code: B.code, hostKey: B.hostKey });
  await B.tv.until(`!!document.querySelector('.jgc-ov.jgc-tv') && document.querySelector('.jgc-ov.jgc-tv').style.visibility !== 'hidden'`, 'party game 1 chest', 9000);
  await ana.until(`!!document.querySelector('.jgc-ov.jgc-phone')`, 'Ana’s game-1 chest', 6000);
  await B.tv.eval(`document.querySelector('[data-jgc-skip]').click(); true`);
  await B.tv.until(`!document.querySelector('.jgc-ov.jgc-tv')`, 'the host skipped it on the TV', 3000);
  await ana.until(`!document.querySelector('.jgc-ov.jgc-phone')`, 'and on the phones', 4000);
  ok('the host skips a chest on the TV: it closes everywhere');
  const host = io(URL + '/box', { transports: ['websocket'], forceNew: true }); await new Promise((r) => host.once('connect', r));
  assert((await emit(host, 'host:resume', { code: B.code, hostKey: B.hostKey })).ok);
  let r = await emit(host, 'host:action', { type: 'partyBoardNow' }); assert(r.ok, JSON.stringify(r));
  r = await emit(host, 'host:action', { type: 'partyNext' }); assert(r.ok, JSON.stringify(r));
  await wait(800);
  await finish(dev, { code: B.code, hostKey: B.hostKey });
  await B.tv.until(`!!document.querySelector('.jgc-ov.jgc-tv:not(.jgc-party)')`, 'party game 2 chest', 9000);
  assert((await emit(host, 'host:action', { type: 'partyBoardNow' })).ok, 'the last game: on to the finale');
  await B.tv.until(`!!document.querySelector('.jgc-ov.jgc-tv.jgc-party') && document.querySelector('.jgc-ov.jgc-tv.jgc-party').style.visibility !== 'hidden'`, 'the legendary party chests', 8000);
  await wait(2200); await snap(B.tv, 'chest-tv-party');
  await ana.until(`!!document.querySelector('.jgc-ov.jgc-phone.jgc-party') && document.querySelector('.jgc-ov.jgc-phone.jgc-party').style.visibility !== 'hidden'`, 'Ana’s legendary chest', 6000);
  await clearPhone(ana);
  assert(await B.tv.eval(`[...document.querySelectorAll('.jgc-cell')].every((c) => c.dataset.tier === 'legendary')`));
  await front(ana); await snap(ana, 'chest-phone-party-open');
  await ana.until(`!!(JGChest.last() && JGChest.active() && JGChest.last().id === JGChest.active().id && document.querySelector('.jgc-ov.jgc-phone.jgc-party'))`, 'the party chest counted', 14000);
  assert(await ana.eval(`[...document.querySelectorAll('.jgc-lines li')].some((l) => /whole night/.test(l.textContent))`), 'everyone who stayed gets the guaranteed bonus');
  await snap(ana, 'chest-phone-party');
  ok('Party Mode finale: the legendary chest on the TV and the phones, with the stayed-all-night bonus');

  const errs = PAGES.flatMap((p) => p.errors); assert.deepEqual(errs, [], 'no page errors');
  host.close(); dev.close();
  console.log(`\nAll ${passed} chest e2e checks passed. Screenshots: ${SHOTS}`);
  cleanup(); process.exit(0);
})().catch(async (e) => { console.error(e); for (const p of PAGES) { try { if (p.errors.length) console.error('page errors', p.errors.slice(0, 3)); } catch { /* */ } } cleanup(); process.exit(1); });
