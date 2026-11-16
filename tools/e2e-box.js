'use strict';
// End-to-end JustGameBox on real pages (headless Chrome): the title screen, then for each
// game a TV lobby with QR + code + settings, a phone joining from the QR link, and a real
// turn played on the phone (President, Blackjack Night, a JustRaiseDucks mini-game + race).
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { CHROME, Browser, startServer, cleanup, wait } = require('./cdp');

const PORT = 3984, URL = `http://localhost:${PORT}`;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'mt-e2e');
if (!CHROME) { console.log('SKIP e2e-box: Chrome not found (set CHROME=path).'); process.exit(0); }
let passed = 0; const PAGES = [];
const ok = (name) => { passed++; console.log(`  ✓ ${name}`); };

async function setup(browser, game, settings = {}) {
  const tv = await browser.page();
  await tv.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await tv.go(`${URL}/box/tv?game=${game}&new=1`);
  await tv.until(`/^[A-Z]{4}$/.test((document.querySelector('#code') || {}).textContent || '')`, game + ' lobby');
  const code = await tv.eval(`document.querySelector('#code').textContent`);
  await tv.until(`document.querySelector('#qr').complete && document.querySelector('#qr').naturalWidth > 100`, 'QR image');
  assert(await tv.eval(`document.querySelectorAll('#settings select').length >= 3`), 'settings shown');
  for (const [k, v] of Object.entries(settings)) await tv.eval(`(() => { const s = document.querySelector('[data-set="${k}"]'); s.value = '${v}'; s.onchange(); return true; })()`);
  const ph = await browser.page();
  await ph.send('Emulation.setDeviceMetricsOverride', { width: 400, height: 820, deviceScaleFactor: 1, mobile: true });
  // Phones scan the QR code: it opens /box/play?room=CODE.
  await ph.go(`${URL}/box/play?room=${code}`);
  await ph.until(`!document.querySelector('#join').hidden && document.querySelector('#j-code').value === '${code}'`, 'join screen prefilled');
  await ph.eval(`document.querySelector('#j-name').value = 'Tess'`); await ph.click('#j-go');
  await ph.until(`!document.querySelector('#game').hidden && /You’re in/.test(document.body.textContent)`, 'phone in lobby');
  await tv.until(`/Tess/.test(document.querySelector('#roster').textContent)`, 'TV shows the player');
  await tv.click('#add-bots');
  await tv.until(`document.querySelectorAll('#roster .chip').length >= 6`, 'bots joined');
  PAGES.push(tv, ph);
  return { tv, ph, code };
}

(async () => {
  await startServer(PORT);
  const browser = new Browser({ shots: SHOTS, debugPort: 9342 }); await browser.launch();

  const hub = await browser.page();
  await hub.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await hub.go(`${URL}/`);
  assert.equal(await hub.eval(`[...document.querySelectorAll('.tile.live h2')].map((h) => h.textContent).join(',')`), 'JustMafia,JustRaiseDucks,President,Blackjack Night');
  assert.equal(await hub.eval(`document.querySelectorAll('.tiles.big .tile').length`), 3, 'three big tiles');
  assert.equal(await hub.eval(`document.querySelectorAll('.tile.empty').length`), 5, 'one big and four small coming-soon slots');
  await hub.shot('box-hub');
  ok('Title screen: JustMafia and JustRaiseDucks big on top (plus a big coming-soon); President, Blackjack Night and four coming-soon slots below');

  // ---------- President ----------
  {
    const { tv, ph, code } = await setup(browser, 'president', { turnSeconds: 15, rounds: 3 });
    await tv.shot('box-president-lobby');
    ok('President lobby: QR code, room code, settings, phone joined from the QR link, bots added');
    // The Mafia join page sends a box room code to the right game.
    const m = await browser.page(); await m.go(`${URL}/play?room=${code}`);
    await m.until(`location.pathname === '/box/play'`, 'redirect to the box phone page', 8000);
    ok('A box room code typed into JustMafia’s join page goes to the right game');
    await tv.click('#start');
    await ph.until(`document.querySelectorAll('.pr-hand .pc').length > 5`, 'hand dealt', 8000);
    await tv.until(`!!document.querySelector('.pr-table')`, 'TV table');
    // Play one real turn from the phone.
    await ph.until(`!!document.querySelector('#pr-play')`, 'my turn', 60000);
    const leading = await ph.eval(`!document.querySelector('#pr-pass')`);
    if (leading) {
      await ph.eval(`document.querySelector('.pr-hand [data-pick]').click(); true`); await wait(250);
      await ph.until(`!document.querySelector('#pr-play').disabled`, 'play enabled');
      const before = await ph.eval(`document.querySelectorAll('.pr-hand .pc').length`);
      await ph.click('#pr-play');
      await ph.until(`document.querySelectorAll('.pr-hand .pc').length === ${before - 1}`, 'card played');
    } else {
      await ph.click('#pr-pass');
      await ph.until(`!document.querySelector('#pr-pass')`, 'passed');
    }
    await ph.shot('box-president-phone'); await tv.shot('box-president-tv');
    ok(`President: a hand is dealt; the phone ${leading ? 'led a card' : 'passed'} on its turn; the TV shows the table`);
  }

  // ---------- Blackjack ----------
  {
    const { tv, ph } = await setup(browser, 'blackjack', { hands: 5 });
    await tv.click('#start');
    await ph.until(`!!document.querySelector('[data-add="25"]')`, 'betting');
    await ph.click('[data-add="25"]'); await wait(200); await ph.click('[data-add="10"]'); await wait(200);
    await ph.until(`/Bet 35/.test(document.querySelector('#bj-bet').textContent)`, 'bet 35');
    await ph.click('#bj-bet');
    await ph.shot('box-blackjack-bet');
    await ph.until(`!!document.querySelector('.bj-myhand')`, 'cards dealt', 25000);
    if (await ph.eval(`!!document.querySelector('[data-op="stand"]')`)) await ph.click('[data-op="stand"]');
    await tv.shot('box-blackjack-tv');
    await ph.until(`/You won|You lost|Push/.test(document.body.textContent)`, 'hand settled', 40000);
    await ph.shot('box-blackjack-result');
    ok('Blackjack: chips → bet 35 → dealt → stand → paid out (or lost) on the phone');
  }

  // ---------- JustRaiseDucks ----------
  {
    const { tv, ph } = await setup(browser, 'ducks', { raceEvery: 60, races: 3 });
    // Live lobby: the TV is already Duck Valley; the phone hatches and dresses its duck before the start.
    await ph.until(`document.querySelectorAll('[data-hatch]').length === 3`, 'egg picker in the lobby');
    await ph.shot('box-ducks-eggs');
    await ph.click('[data-hatch="1"]');
    await ph.until(`!!document.querySelector('.dk-lobbycard')`, 'lobby: dress up your duck', 8000);
    await tv.until(`!!document.querySelector('#dk-valley') && /Duck Valley/.test(document.querySelector('#dk-next').textContent)`, 'TV shows Duck Valley in the lobby');
    await wait(800); await ph.shot('box-ducks-lobby-phone'); await tv.shot('box-ducks-lobby-tv');
    // Jackbox-style: the first player to join is the host and starts the game from their phone.
    await ph.until(`!!document.querySelector('[data-vip="start"]')`, 'host start button on the phone');
    await ph.click('[data-vip="start"]');
    await ph.until(`!!document.querySelector('[data-sheet="run"]')`, 'started: skill cards', 8000);
    ok('JustRaiseDucks lobby: Duck Valley on the TV before the start; egg hatched and duck named in the lobby; the first player (host) started from their phone');
    await ph.until(`!!document.querySelector('.dk-herocv')`, 'farm hero canvas');
    await tv.until(`!!document.querySelector('#dk-valley') && /6 farms/.test(document.querySelector('#dk-next').textContent)`, 'Duck Valley with 6 farms');
    await ph.shot('box-ducks-phone');
    await ph.click('[data-tab="duck"]'); await ph.until(`!!document.querySelector('[data-color="mallard"]')`, 'my duck tab');
    await ph.click('[data-color="mallard"]');
    await ph.click('[data-tab="shop"]'); await ph.until(`!!document.querySelector('[data-cat="farm"]')`, 'shop tab');
    await ph.click('[data-cat="farm"]'); await ph.until(`!!document.querySelector('[data-build="pool"]')`, 'farm category');
    await ph.shot('box-ducks-shop');
    await ph.click('[data-build="pool"]'); await tv.until(`/built a Lap Pool/.test(document.querySelector('#dk-news').textContent)`, 'TV news: Lap Pool built');
    await ph.click('.dk-hero'); // tap the farm to pet the duck
    await ph.click('[data-tab="race"]'); await ph.until(`!!document.querySelector('[data-tactic="sprint"]')`, 'race tab');
    await ph.click('[data-tactic="sprint"]'); await ph.until(`document.querySelector('[data-tactic="sprint"]').classList.contains('on')`, 'tactic chosen');
    await ph.shot('box-ducks-racetab'); await wait(1200); await tv.shot('box-ducks-valley');
    await ph.click('[data-tab="train"]'); await ph.until(`!!document.querySelector('[data-spin]')`, 'train tab with Lucky Spin');
    await ph.click('[data-spin]'); await ph.until(`!!document.querySelector('.dk-prize button')`, 'spin prize', 8000);
    await ph.shot('box-ducks-spin'); await ph.click('.dk-prize button');
    await ph.click('[data-sheet="swim"]'); await ph.until(`document.querySelectorAll('[data-diff]').length === 3`, 'difficulty sheet');
    await ph.click('[data-diff="easy"]'); await ph.until(`document.querySelector('[data-diff="easy"]').classList.contains('on')`, 'easy chosen');
    await ph.shot('box-ducks-sheet');
    await ph.click('[data-play]');
    await ph.until(`!!document.querySelector('.dk-over [data-pad]')`, 'paddle mini-game', 5000);
    await ph.until(`!document.querySelector('.dk-ready') || document.querySelector('.dk-ready').textContent === 'GO!'`, 'GO');
    for (let i = 0; i < 40; i++) { await ph.eval(`document.querySelector('[data-pad="${i % 2 ? 'R' : 'L'}"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); true`); await wait(60); }
    await ph.shot('box-ducks-minigame');
    await ph.until(`/XP/.test((document.querySelector('.dk-result') || {}).textContent || '')`, 'mini-game reward', 30000);
    const res = await ph.eval(`document.querySelector('.dk-result').textContent`);
    assert(/Score (\d+)/.test(res) && Number(res.match(/Score (\d+)/)[1]) >= 8, res);
    await ph.shot('box-ducks-reward');
    await ph.click('.dk-result button');
    ok('JustRaiseDucks: Lucky Spin; Easy/Medium/Hard sheet; egg picked and hatched; Duck Valley shows every farm; color, Lap Pool from the shop (TV news), pet, tactic; Paddle Power earned XP and coins');
    await tv.eval(`document.querySelector('[data-h="next"]').click(); true`); // start the race now
    await tv.until(`!!document.querySelector('#dk-race')`, 'race canvas');
    await wait(4000); await tv.shot('box-ducks-race-intro'); await wait(9000); await tv.shot('box-ducks-race');
    await ph.until(`!!document.querySelector('#dk-cheer')`, 'phone cheer button'); await ph.click('#dk-cheer'); await ph.shot('box-ducks-cheer');
    await tv.until(`!!document.querySelector('.dk-podium')`, 'podium', 40000);
    await tv.shot('box-ducks-results');
    ok('JustRaiseDucks: the race runs on the TV (canvas), then the podium and points');
  }
  PAGES.push(hub);
  assert.deepEqual(PAGES.flatMap((p) => p.errors || []), [], 'no page errors');
  ok('No page errors on the title screen, TVs or phones');
  console.log(`\nAll ${passed} JustGameBox end-to-end checks passed. Screenshots: ${SHOTS}`);
  await cleanup(); process.exit(0);
})().catch(async (e) => { console.error(e); setTimeout(() => process.exit(1), 4000); try { await cleanup(); } catch {} process.exit(1); });
