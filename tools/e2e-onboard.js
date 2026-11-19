'use strict';
// End-to-end onboarding on real pages (headless Chrome, muted): the first-visit "How it works" on
// the title screen (shows once, any key skips, replay link), "New here? Start with these 5" (only
// unlocked games, names from the tiles, hide), "Just pick for us" (a short Party Mode with practice
// rounds for new games), the unlock banner and a locked tile's card, a practice round on the TV
// and a phone (PRACTICE badge, tips, "Now for real!", then the real game with the real settings),
// the phone's first-join tour, and "Save your stuff" only after a finished game.
//   node tools/e2e-onboard.js
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { CHROME, Browser, startServer, cleanup, wait } = require('./cdp');

const PORT = 4510, URL = `http://localhost:${PORT}`;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'mt-e2e');
if (!CHROME) { console.log('SKIP e2e-onboard: Chrome not found (set CHROME=path).'); process.exit(0); }
let passed = 0; const PAGES = [];
const ok = (name) => { passed++; console.log(`  ✓ ${name}`); };
const key = (pg, k = 'x') => pg.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, text: k.length === 1 ? k : undefined }).then(() => pg.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k }));

(async () => {
  await startServer(PORT);
  const browser = new Browser({ shots: SHOTS, debugPort: 9810 }); await browser.launch();
  const page = async (w, h, mobile = false) => { const p = await browser.page(); await p.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile }); PAGES.push(p); return p; };

  // ---------- How it works: the first time only ----------
  const hub = await page(1600, 900);
  await hub.go(`${URL}/`);
  await hub.until(`!!document.querySelector('#hiw.in')`, 'How it works opens by itself', 5000);
  assert.equal(await hub.eval(`document.querySelectorAll('#hiw .hiw-prog span').length`), 7, 'seven scenes');
  assert.match(await hub.eval(`document.querySelector('#hiw-cap').textContent`), /JustGameBox/);
  assert(await hub.eval(`window.HUB_ONBOARD.TOTAL >= 55000 && window.HUB_ONBOARD.TOTAL <= 65000`), 'about a minute');
  await hub.eval(`document.querySelector('#hiw-next').click(); true`); await wait(300);
  assert.match(await hub.eval(`document.querySelector('#hiw-cap').textContent`), /controller/i, 'next scene: phones are the controllers');
  assert(await hub.eval(`/\\/join/.test(document.querySelector('#hiw-cap').textContent)`), 'says where to join');
  await hub.shot('onboard-hiw-join');
  await key(hub, 'x'); await wait(600);
  assert(await hub.eval(`!document.querySelector('#hiw')`), 'any key skips it');
  assert.equal(await hub.eval(`localStorage.getItem('box.hiw')`), '1');
  await hub.go(`${URL}/`); await wait(1200);
  assert(await hub.eval(`!document.querySelector('#hiw')`), 'not again on the next visit');
  await hub.click('#hiw-open'); await hub.until(`!!document.querySelector('#hiw.in')`, 'replay from the link');
  await hub.click('#hiw-skip'); await wait(600);
  assert(await hub.eval(`!document.querySelector('#hiw')`), 'Skip closes it');
  ok('How it works: opens by itself the first time (7 scenes, ~1 min), any key skips, never again by itself, replay link + Skip');

  // ---------- New here? Start with these 5 ----------
  const nh = await hub.eval(`[...document.querySelectorAll('#new-here .nh-card')].map((c) => ({ key: c.dataset.game, name: c.querySelector('b').textContent, tile: document.querySelector('.tile[data-game="' + c.dataset.game + '"] h2').textContent.trim(), locked: document.querySelector('.tile[data-game="' + c.dataset.game + '"]').classList.contains('locked') }))`);
  assert.equal(nh.length, 5, 'five games');
  assert.deepEqual(nh.slice(0, 4).map((g) => g.key), ['likely', 'pizza', 'emoji', 'snap']);
  assert(!nh.some((g) => g.key === 'quickdraw'), 'Quick Draw is locked: not shown');
  assert.equal(nh[4].key, 'price', 'the next beginner game takes its place');
  for (const g of nh) { assert.equal(g.name, g.tile, 'name read from the tile'); assert.equal(g.locked, false); }
  assert(await hub.eval(`/New here\\? Start with these 5/.test(document.querySelector('#new-here').textContent)`));
  await hub.shot('onboard-new-here');
  // Keyboard: the cards are part of the arrow-key menu.
  assert(await hub.eval(`(() => { const c = document.querySelector('.nh-card'); window.HUB_NAV.select(c); return c.classList.contains('sel'); })()`), 'cards take the remote');
  // Just pick for us: a short party of easy games for the group.
  const lineup = await hub.eval(`window.HUB_ONBOARD.lineupFor(6)`);
  assert(lineup.length >= 3 && lineup.length <= 4, 'a 3–4 game lineup: ' + lineup);
  assert(lineup.every((k) => nh.some((g) => g.key === k)), 'only the easy, unlocked games');
  // Hide the row (remembered).
  await hub.click('#nh-hide'); await wait(500);
  assert(await hub.eval(`document.querySelector('#new-here').hidden`));
  await hub.go(`${URL}/`); await wait(600);
  assert(await hub.eval(`document.querySelector('#new-here').hidden`), 'stays hidden');
  // With everything unlocked, Quick Draw is back among the five.
  await hub.eval(`localStorage.removeItem('box.newHereHidden'); window.UNLOCKS.unlockAll(); true`);
  await hub.go(`${URL}/`); await wait(600);
  assert(await hub.eval(`[...document.querySelectorAll('#new-here .nh-card')].some((c) => c.dataset.game === 'quickdraw')`), 'Quick Draw once unlocked');
  // "What's new": the unlocked games, with a celebration.
  assert(await hub.eval(`!document.querySelector('#whats-new').hidden && /new games unlocked|is unlocked/.test(document.querySelector('#whats-new').textContent)`), "What's new banner");
  await hub.shot('onboard-whats-new');
  await hub.eval(`window.UNLOCKS.lockAll(); true`);
  ok('New here: Most Likely To, JustPizza, Emoji Charades, JustSnap + Price Panic while Quick Draw is locked (names from the tiles); remote, hide, What\'s new');

  // ---------- Locked games ----------
  await hub.go(`${URL}/`); await wait(600);
  const tip = await hub.eval(`document.querySelector('#unlock-tip').textContent`);
  const total = await hub.eval(`document.querySelectorAll('.tile[data-game]').length`), open = await hub.eval(`document.querySelectorAll('.tile[data-game]:not(.locked)').length`);
  assert(tip.includes(`${open}/${total} unlocked`) && /Play games to unlock more/.test(tip), tip);
  assert(/Finish/.test(tip), 'says what to play next');
  await hub.eval(`document.querySelector('.tile.quickdraw').click(); true`);
  await hub.until(`!!document.querySelector('.lk-card')`, 'locked card');
  assert.match(await hub.eval(`document.querySelector('.lk-card').textContent`), /Quick Draw is locked.*Finish a game of President/s);
  assert(await hub.eval(`/Play President/.test(document.querySelector('.lk-go').textContent)`));
  await hub.shot('onboard-locked');
  await key(hub, 'Escape'); await wait(200);
  assert(await hub.eval(`!document.querySelector('.lk-card')`), 'Esc closes it');
  ok(`Locked games: "Play games to unlock more: ${open}/${total} unlocked" with what to finish next; a locked tile says what unlocks it, with a Play button`);

  // ---------- Just pick for us → a short Party Mode, practice rounds for new games ----------
  await hub.eval(`document.querySelector('#nh-go').click(); true`);
  await hub.until(`location.pathname === '/box/tv' && /^[A-Z]{4}$/.test((document.querySelector('#code') || {}).textContent || '')`, 'party TV lobby', 10000);
  const pmState = await hub.eval(`new Promise((done) => { const s = io('/box'); const h = JSON.parse(localStorage.getItem('box.host')); s.emit('host:resume', h, () => s.once('tv', (st) => { s.close(); done({ pm: st.partyMode, practice: st.settings.practice }); })); })`);
  assert.equal(pmState.pm.practice, 'new'); assert(pmState.pm.games.length >= 3); assert.equal(pmState.pm.minutes, 30);
  assert.equal(pmState.practice, true, 'the first game gets a practice round (new to this TV)');
  ok(`Just pick for us: a 30-minute Party Mode (${pmState.pm.games.join(', ')}), practice rounds only for new games`);

  // ---------- A practice round, TV + phone ----------
  const tv = await page(1600, 900);
  await tv.go(`${URL}/box/tv?game=likely&new=1`); // a new TV: practice is on by default
  await tv.until(`/^[A-Z]{4}$/.test((document.querySelector('#code') || {}).textContent || '')`, 'lobby', 10000);
  assert.equal(await tv.eval(`document.querySelector('[data-set="practice"]').value`), 'true', 'Practice round first: on for a new TV');
  const code = await tv.eval(`document.querySelector('#code').textContent`);
  const ph = await page(400, 820, true);
  await ph.go(`${URL}/j/${code}`);
  await ph.until(`!document.querySelector('#join').hidden && !!document.querySelector('#j-acct .jga-banner')`, 'join screen + account line', 8000);
  assert(await ph.eval(`!/Save your stuff/.test(document.querySelector('#j-acct').textContent) && /Sign in/.test(document.querySelector('#j-acct').textContent)`), 'before any game: only "Sign in", no "Save your stuff"');
  await ph.eval(`document.querySelector('#j-name').value = 'Tess'; document.querySelector('#j-go').click(); true`);
  await ph.until(`!document.querySelector('#game').hidden`, 'phone in');
  await ph.until(`!!document.querySelector('#ph-tour')`, 'first-join tour', 5000);
  assert.match(await ph.eval(`document.querySelector('#ph-tour').textContent`), /This is you/);
  await ph.shot('onboard-phone-tour');
  await ph.eval(`document.querySelector('.pt-skip').click(); true`); await wait(500);
  assert(await ph.eval(`!document.querySelector('#ph-tour') && localStorage.getItem('box.tour') === '1'`), 'tour skipped and remembered');
  await tv.click('#add-bots'); await wait(1200);
  await tv.eval(`document.querySelector('#start').click(); true`);
  await tv.until(`!!document.querySelector('#show-skip')`, 'intro', 8000);
  assert(await tv.eval(`!!document.querySelector('#pr-badge.in-show')`), 'the intro says a practice round comes first');
  for (let i = 0; i < 6 && await tv.eval(`!!document.querySelector('#show-skip')`); i++) { await tv.eval(`document.querySelector('#show-skip').click(); true`); await wait(600); }
  await tv.until(`!!document.querySelector('#pr-badge:not(.in-show)')`, 'PRACTICE badge', 8000);
  assert.match(await tv.eval(`document.querySelector('#pr-badge').textContent`), /PRACTICE/);
  await ph.until(`/Practice round/.test(document.querySelector('#vip-bar').textContent)`, 'phone: practice strip');
  await ph.until(`!!document.querySelector('#pr-hint')`, 'phone: a tip from the how-to steps', 15000);
  assert.match(await ph.eval(`document.querySelector('#pr-hint').textContent`), /PRACTICE TIP 1 of \d/);
  await tv.shot('onboard-tv-practice'); await ph.shot('onboard-phone-practice');
  await tv.until(`!!document.querySelector('#pr-over')`, '"Now for real!"', 150000);
  assert.match(await tv.eval(`document.querySelector('#pr-over').textContent`), /Now for real!/);
  await ph.until(`/Now for real!/.test(document.querySelector('#g-body').textContent)`, 'phone: now for real');
  await tv.shot('onboard-tv-now-for-real');
  await tv.until(`!document.querySelector('#pr-over') && !document.querySelector('#pr-badge')`, 'the real game', 15000);
  await tv.until(`/of 15/.test(document.querySelector('#g-area').textContent)`, 'the real settings (15 prompts)', 8000);
  assert(await tv.eval(`!/show-skip/.test(document.querySelector('#tv-main').innerHTML)`), 'no intro the second time');
  ok('Practice round: on by default for a new TV; badge on the intro and in the game, phone tips from the how-to, "Now for real!", then the real game with the real settings and no intro');

  // ---------- "Save your stuff" only after a finished game ----------
  // Skip ahead to the end of the real game from the TV.
  for (let i = 0; i < 200 && !(await tv.eval(`!!document.querySelector('[data-h="again"]')`)); i++) { await tv.eval(`(document.querySelector('#host-row [data-h="next"]') || { click() {} }).click(); true`); await wait(120); }
  await tv.until(`!!document.querySelector('[data-h="again"]')`, 'game over', 20000);
  await ph.until(`!!document.querySelector('#jga-nudge')`, 'the after-game "Save your stuff"', 12000);
  assert.match(await ph.eval(`document.querySelector('#jga-nudge').textContent`), /Save/);
  assert.equal(await ph.eval(`localStorage.getItem('jg.played')`), '1');
  await ph.shot('onboard-phone-save-after-game');
  // With JustGold just earned it says so.
  const earned = await ph.eval(`(async () => { sessionStorage.removeItem('jga.nudged'); document.querySelector('#jga-nudge').remove(); const a = JGAccount.create({ socket: io('/box') }); await a.nudge(document.body, { earned: 15 }); return document.querySelector('#jga-nudge').textContent; })()`);
  assert.match(earned, /You earned 15 JG!.*Save it with a name \+ password/);
  // The shop: a fresh phone sees only "Sign in"; this phone (a game played) sees the card.
  const fresh = await page(400, 820, true);
  await fresh.go(`${URL}/shop`); await wait(1500);
  const shopFresh = await fresh.eval(`(document.querySelector('#acct') || {}).textContent || ''`);
  assert(!/Save your stuff/.test(shopFresh), 'shop, before any game: no card (' + shopFresh + ')');
  ok('"Save your stuff": never before the first finished game (join screen, shop); after it, on the game-over screen ("You earned 15 JG! Save it…")');

  const pageErrors = PAGES.flatMap((p) => p.errors || []);
  if (pageErrors.length) console.log('PAGE ERRORS:\n' + pageErrors.map((e) => '  ' + String(e).slice(0, 400)).join('\n'));
  assert.deepEqual(pageErrors, [], 'no page errors');
  ok('No page errors');
  console.log(`\nAll ${passed} onboarding end-to-end checks passed. Screenshots: ${SHOTS}`);
  await cleanup(); process.exit(0);
})().catch(async (e) => { console.error(e); setTimeout(() => process.exit(1), 4000); try { await cleanup(); } catch {} process.exit(1); });
