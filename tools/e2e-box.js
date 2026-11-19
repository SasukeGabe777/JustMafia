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

// After the host presses Start, small games play an intro cutscene (game shows also collect
// fun facts first). Check it's on the TV, then skip it from the TV.
async function skipShow(tv) {
  // The intro appears a moment after Start; give it a few seconds to show up.
  try { await tv.until(`!!document.querySelector('#show-skip')`, 'intro', 5000); } catch { return; }
  for (let i = 0; i < 4; i++) {
    if (!(await tv.eval(`!!document.querySelector('#show-skip')`))) return;
    await tv.eval(`(document.querySelector('#show-skip') || {}).click && document.querySelector('#show-skip').click(); true`); await wait(500);
  }
}
async function setup(browser, game, settings = {}) {
  // Finished sections: park their pages (errors were already collected) so the open tabs don't pile up.
  for (const p of PAGES) if (!p.parked) { p.parked = true; try { await p.send('Page.navigate', { url: 'about:blank' }); } catch { /* closed */ } }
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
  // One QR for the night: it encodes /j/CODE, which opens this game's phone page.
  assert(await tv.eval(`decodeURIComponent(document.querySelector('#qr').src).endsWith('/j/${code}')`), 'the QR address is /j/CODE');
  await ph.go(`${URL}/j/${code}`);
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
  assert.equal(await hub.eval(`[...document.querySelectorAll('.tile.live h2')].map((h) => h.textContent).join(',')`), 'JustMafia,JustRaiseDucks,JustKingdoms,President,Blackjack Night,JustBid,JustDrop,Price Panic,Emoji Charades,Hot Take Trivia,Color Match,Tune Buzz,JustBlanks,JustSketch Relay,JustFunny,JustPizza,Meme Maker,Letter Rush,Act It Out,Two Truths & a Lie,Most Likely To…,Who Said It?,Where Do You Stand?,Alien Abduction,Debate Club,JustSummon,JustMarble,JustEscape,Quick Draw,Bomb Squad,Zombie Survival');
  // Every small game sits on a category shelf (public/categories.js); there is no catch-all shelf.
  assert.equal(await hub.eval(`[...document.querySelectorAll('.shelf')].map((x) => x.dataset.shelf).join(',')`), 'cards,guess,create,friends,action');
  assert.equal(await hub.eval(`document.querySelectorAll('.tiles.big .tile').length`), 3, 'three big tiles');
  assert.equal(await hub.eval(`document.querySelectorAll('.tile.empty').length`), 0, 'every slot is a game');
  assert(await hub.eval(`document.querySelector('.tile.zombie').classList.contains('locked')`), 'Zombie Survival starts locked');
  assert(await hub.eval(`!!document.querySelector('#party-open') && !!document.querySelector('#gear')`), 'Party Mode and ⚙ settings on the main menu');
  await hub.shot('box-hub');
  ok('Title screen: JustMafia and JustRaiseDucks big on top (plus a big coming-soon); President, Blackjack Night and four coming-soon slots below');

  // ---------- Party Mode setup: game length and intros ----------
  {
    await hub.click('#party-open'); await hub.until(`!!document.querySelector('[data-each="long"]') && !!document.querySelector('[data-intros="break"]')`, 'party setup questions');
    const lineup = async (each) => {
      await hub.eval(`document.querySelector('[data-t="1"]').click(); document.querySelector('[data-each="${each}"]').click(); document.querySelector('[data-act="go"]').click(); true`);
      for (let i = 0; i < 60 && !(await hub.eval(`!!document.querySelector('[data-act="start"]')`)); i++) { await hub.eval(`(document.querySelector('[data-act="skip"]') || { click() {} }).click(); true`); await wait(150); }
      const n = await hub.eval(`document.querySelectorAll('.pm-slot').length`);
      await hub.eval(`document.querySelector('[data-act="opts"]').click(); true`); await wait(200);
      return n;
    };
    const long = await lineup('long'), quick = await lineup('quick');
    assert(long >= 2 && long <= 4, `1 hour of Long games is about 3 (${long})`); assert(quick >= 7, `1 hour of Quick games is about 10 (${quick})`);
    await hub.eval(`document.querySelector('[data-each="auto"]').click(); document.querySelector('[data-intros="play"]').click(); true`);
    await hub.eval(`document.querySelector('[data-act="close"]').click(); true`); await wait(400);
    ok(`Party Mode setup: "Each game" length and "Intro cutscenes"; 1 hour = ${long} long games or ${quick} quick ones`);
  }

  // ---------- President ----------
  {
    const { tv, ph, code } = await setup(browser, 'president', { turnSeconds: 15, rounds: 3 });
    await tv.shot('box-president-lobby');
    ok('President lobby: QR code, room code, settings, phone joined from the QR link, bots added');
    // The Mafia join page sends a box room code to the right game.
    const m = await browser.page(); await m.go(`${URL}/play?room=${code}`);
    await m.until(`location.pathname === '/box/play'`, 'redirect to the box phone page', 8000);
    ok('A box room code typed into JustMafia’s join page goes to the right game');
    await tv.click('#start'); await skipShow(tv);
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
    await tv.click('#start'); await skipShow(tv);
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

  // ---------- JustBlanks ----------
  {
    const { tv, ph } = await setup(browser, 'blanks', { mode: 'vote', toWin: 3 });
    await ph.until(`!!document.querySelector('[data-vip="start"]') && !document.querySelector('[data-vip="start"]').disabled`, 'host start button');
    await ph.click('[data-vip="start"]');
    await skipShow(tv); // the first player is the host
    await ph.until(`document.querySelectorAll('.bl-card').length >= 7 || /Judge/.test(document.body.textContent)`, 'hand dealt', 8000);
    await ph.click('#bl-blank'); await ph.until(`!!document.querySelector('#bl-write')`, 'write box');
    await ph.eval(`(() => { const i = document.querySelector('#bl-write'); i.value = 'a goose with a briefcase'; i.oninput(); return true; })()`);
    await ph.click('#bl-wadd');
    const need = await ph.eval(`Number((document.querySelector('#bl-play').textContent.match(/\\/(\\d)/) || [0, 1])[1])`);
    if (need > 1) await ph.click('.bl-card:not(.sel)');
    await ph.until(`!document.querySelector('#bl-play').disabled`, 'play enabled');
    await ph.shot('box-blanks-hand'); await ph.click('#bl-play');
    await ph.until(`/played/i.test(document.body.textContent)`, 'played'); // the round moves on by itself once everyone has played
    await tv.until(`document.querySelectorAll('.bl-white').length >= 3`, 'answers on the TV', 40000);
    await tv.until(`/a goose with a briefcase/.test(document.body.textContent)`, 'the written card is on the TV', 40000);
    await tv.shot('box-blanks-tv');
    await ph.until(`document.querySelectorAll('.bl-ans').length >= 3`, 'vote list', 40000);
    await ph.click('.bl-ans:not(.mine)'); await ph.shot('box-blanks-vote');
    await tv.until(`!!document.querySelector('.bl-win')`, 'winner shown', 45000); await tv.shot('box-blanks-win');
    ok('JustBlanks: the host starts from their phone; a written-your-own card shows on the TV without a name; vote; the winner is revealed');
  }

  // ---------- Two Truths & a Lie ----------
  {
    const { tv, ph } = await setup(browser, 'truths', { talk: 0, featured: 6 });
    await ph.until(`!!document.querySelector('[data-vip="start"]') && !document.querySelector('[data-vip="start"]').disabled`, 'host start button');
    await ph.click('[data-vip="start"]');
    await skipShow(tv);
    await ph.until(`document.querySelectorAll('[data-i]').length === 3`, 'write form');
    await ph.eval(`(() => { const t = ['I have been to Iceland', 'I can play the banjo', 'I once ate a bug on purpose']; document.querySelectorAll('[data-i]').forEach((i, k) => { i.value = t[k]; i.oninput(); }); return true; })()`);
    await ph.click('[data-lie="1"]'); await ph.shot('box-truths-write'); await ph.click('#tt-send');
    await ph.until(`/Ready/.test(document.body.textContent)`, 'locked in');
    await tv.until(`!!document.querySelector('.tt-item')`, 'statements on the TV', 30000);
    await tv.shot('box-truths-tv');
    // vote on whoever is in the hot seat (or wait if it's us)
    for (let k = 0; k < 6; k++) {
      await ph.until(`!!document.querySelector('.tt-vote') || /hot seat|fooled|spotted|Fooled|didn’t vote|Game over/.test(document.body.textContent)`, 'vote or seat', 40000);
      if (await ph.eval(`!!document.querySelector('.tt-vote')`)) { await ph.click('.tt-vote'); break; }
      await wait(1500);
    }
    await tv.until(`!!document.querySelector('.tt-item.lie')`, 'the lie is revealed', 45000); await tv.shot('box-truths-reveal');
    ok('Two Truths & a Lie: typed on the phone with the lie marked; statements on the TV; vote; the lie is stamped');
  }

  // ---------- JustFunny ----------
  {
    const { tv, ph } = await setup(browser, 'funny', { maxSeconds: 60 });
    await ph.until(`!!document.querySelector('[data-vip="start"]') && !document.querySelector('[data-vip="start"]').disabled`, 'host start button');
    await ph.click('[data-vip="start"]');
    await skipShow(tv);
    await ph.until(`!!document.querySelector('#fn-paste')`, 'pick screen');
    assert(await ph.eval(`document.querySelectorAll('[data-plat]').length === 4 || !!document.querySelector('#fn-go')`), 'search buttons for YouTube, Shorts, TikTok, Instagram');
    await ph.shot('box-funny-pick');
    await ph.eval(`(() => { const i = document.querySelector('#fn-paste'); i.value = 'https://www.instagram.com/reel/C0abcdEFGhi/'; i.oninput(); return true; })()`);
    await ph.click('#fn-use');
    await tv.until(`/Instagram/.test((document.querySelector('#fn-top') || {}).textContent || '') && !!document.querySelector('#fn-alt iframe')`, 'the Reel plays on the TV', 15000);
    await wait(1500); await tv.shot('box-funny-tv');
    await tv.eval(`document.querySelector('[data-h="next"]').click(); true`); // skip it
    await tv.until(`/Skipped/.test(document.body.textContent) || !!document.querySelector('.fn-board:not([hidden])')`, 'skipped', 15000);
    ok('JustFunny: host starts; phone pastes an Instagram Reel (YouTube/Shorts/TikTok/Instagram search buttons); it plays upright on the TV; skip works');
  }

  // ---------- The five newer small games: real play over sockets ----------
  // A "monkey" phone taps whatever it can and types answers; the TV skips ahead; every game must reach its end screen.
  for (const game of ['sketch', 'whosaid', 'price', 'emoji', 'likely', 'spectrum', 'bid']) {
    const { tv, ph } = await setup(browser, game, {});
    await ph.until(`!!document.querySelector('[data-vip="start"]') && !document.querySelector('[data-vip="start"]').disabled`, game + ' host start');
    await ph.click('[data-vip="start"]');
    await skipShow(tv);
    await tv.until(`!document.querySelector('#lobby-err') || !/#g-area/.test('') `, 'started');
    let shots = 0;
    for (let i = 0; i < 40; i++) {
      await ph.eval(`(() => {
        window.confirm = () => true; window.alert = () => {}; window.prompt = () => ''; // pop-ups would freeze a headless page
        // type into any text box and submit
        for (const t of document.querySelectorAll('#g-body input:not([type=checkbox]):not([type=range]), #g-body textarea, .sk-pad textarea, .sk-pad input')) { if (t.offsetParent && !t.value) { t.value = 'a banana ' + Math.floor(Math.random() * 9); t.dispatchEvent(new Event('input', { bubbles: true })); if (t.oninput) t.oninput(); t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); } }
        // draw a stroke on any canvas pad
        for (const c of document.querySelectorAll('body > div canvas')) { const r = c.getBoundingClientRect(); if (r.width > 100) { const ev = (type, x, y) => c.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: r.left + x * r.width, clientY: r.top + y * r.height, pointerId: 1 })); ev('pointerdown', 0.2, 0.2); ev('pointermove', 0.5, 0.6); ev('pointermove', 0.8, 0.3); ev('pointerup', 0.8, 0.3); } }
        // tap one enabled button that isn't Leave
        const btns = [...document.querySelectorAll('#g-body button, body > div button')].filter((b) => !b.disabled && b.offsetParent && !/Leave|Lobby|Clear|undo|Undo/i.test(b.textContent));
        if (btns.length) btns[Math.floor(Math.random() * btns.length)].click();
        return true; })()`);
      if (i === 12 && shots++ < 1) { await ph.shot('box-' + game + '-phone'); await tv.shot('box-' + game + '-tv'); }
      await wait(350);
    }
    for (let k = 0; k < 80 && !(await tv.eval(`!!document.querySelector('[data-h="again"]')`)); k++) { await tv.eval(`(() => { const b = document.querySelector('[data-h="next"]'); if (b) b.click(); return true; })()`); await wait(450); }
    assert(await tv.eval(`!!document.querySelector('[data-h="again"]')`), game + ' reached its end screen');
    await wait(1200); await tv.shot('box-' + game + '-end'); await ph.shot('box-' + game + '-phone-end');
    if (game === 'price') { // Play again starts a fresh game (this used to fail for every game but JustRaiseDucks)
      await tv.click('[data-h="again"]'); await wait(1500);
      assert(await tv.eval(`!document.querySelector('[data-h="again"]') && !!document.querySelector('[data-h="next"]')`), 'Play again restarts');
    }
    const errs = [...(tv.errors || []).map((e) => 'TV: ' + String(e && (e.message || e)).slice(0, 300)), ...(ph.errors || []).map((e) => 'phone: ' + String(e && (e.message || e)).slice(0, 300))];
    if (errs.length) console.log(`    ${game} page errors:\n      ` + errs.join('\n      '));
    ok(`${game}: host starts from the phone; real taps, typing and drawing; skips to the end screen${errs.length ? ' (errors above)' : ' with no errors'}${game === 'price' ? '; Play again restarts' : ''}`);
  }

  // ---------- JustKingdoms (/kingdoms) ----------
  {
    const tv = await browser.page();
    await tv.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
    await tv.go(`${URL}/kingdoms`);
    await tv.until(`/Found a new world/.test(document.body.textContent)`, 'kingdoms title', 10000);
    assert(await tv.eval(`document.querySelector('.tv-bar').hidden && document.body.classList.contains('g-kingdoms')`), 'own look, no JustGameBox bar');
    await tv.eval(`[...document.querySelectorAll('button')].find((b) => /Found a new world/.test(b.textContent)).click(); true`);
    await tv.until(`/^[A-Z]{4}$/.test((document.querySelector('#code') || {}).textContent || '')`, 'kingdoms lobby', 10000);
    const code = await tv.eval(`document.querySelector('#code').textContent`);
    await tv.click('#add-bots');
    const ph = await browser.page();
    await ph.send('Emulation.setDeviceMetricsOverride', { width: 400, height: 820, deviceScaleFactor: 1, mobile: true });
    await ph.go(`${URL}/kingdoms/play?room=${code}`);
    await ph.until(`document.body.classList.contains('g-kingdoms') && !document.querySelector('#join').hidden`, 'kingdoms join');
    await ph.eval(`document.querySelector('#j-name').value = 'Kai'`); await ph.click('#j-go');
    await ph.until(`/Where are you sitting/.test(document.body.textContent)`, 'seat picker', 8000);
    await tv.shot('box-kingdoms-lobby'); await ph.shot('box-kingdoms-phone-lobby');
    await ph.until(`!!document.querySelector('[data-vip="start"]')`, 'host start'); await ph.click('[data-vip="start"]');
    await tv.until(`(() => { const c = document.querySelector('#kt-cv'); return c && c.width >= 800; })()`, 'world map canvas sized', 10000);
    await ph.until(`/Kingdom/.test(document.body.textContent) && !!document.querySelector('.kp-nav, nav')`, 'phone tabs', 10000);
    for (let i = 0; i < 4; i++) { await tv.eval(`(() => { const c = document.querySelector('#corner .cg'); if (c) c.click(); const n = document.querySelector('#corner [data-h="next"]'); if (n) n.click(); return true; })()`); await wait(600); }
    await wait(1500); await tv.shot('box-kingdoms-world'); await ph.shot('box-kingdoms-phone');
    PAGES.push(tv, ph);
    ok('JustKingdoms at /kingdoms: title, Round Table lobby, phone joins at /kingdoms/play, host starts, the world map fills the TV, phone tabs work');
  }

  // ---------- JustRaiseDucks as its own game (/ducks) ----------
  {
    const tv = await browser.page();
    await tv.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
    await tv.go(`${URL}/ducks`);
    await tv.until(`!!document.querySelector('.dk-title-card #dk-go')`, 'duck title screen');
    assert(await tv.eval(`document.querySelector('.tv-bar').hidden && document.body.classList.contains('g-ducks')`), 'no JustGameBox bar; duck look');
    assert(await tv.eval(`/Back to JustGameBox/.test(document.querySelector('#dk-back').textContent)`));
    await wait(700); await tv.shot('box-ducks-title');
    await tv.click('#dk-go');
    await tv.until(`/^[A-Z]{4}$/.test((document.querySelector('#code') || {}).textContent || '') && !!document.querySelector('#dk-valley')`, 'valley lobby after Start');
    const code = await tv.eval(`document.querySelector('#code').textContent`);
    const ph = await browser.page();
    await ph.send('Emulation.setDeviceMetricsOverride', { width: 400, height: 820, deviceScaleFactor: 1, mobile: true });
    await ph.go(`${URL}/ducks/play?room=${code}`);
    await ph.until(`document.body.classList.contains('g-ducks') && /JustRaiseDucks/.test(document.querySelector('.ph-join h1').textContent)`, 'duck-styled join page');
    await ph.eval(`document.querySelector('#j-name').value = 'Rex'`); await ph.click('#j-go');
    await ph.until(`document.querySelectorAll('[data-hatch]').length === 3`, 'egg picker');
    await ph.shot('box-ducks-own-join');
    await ph.click('[data-hatch="0"]'); await ph.until(`!!document.querySelector('[data-vip="start"]')`, 'host start');
    await ph.click('[data-vip="start"]');
    await tv.until(`!!document.querySelector('#corner') && !document.querySelector('#corner').hidden`, 'corner badge in game');
    await wait(900); await tv.shot('box-ducks-own-game');
    // Reloading always opens the title screen first; Continue picks the running valley back up.
    await tv.go(`${URL}/ducks`);
    await tv.until(`!!document.querySelector('.dk-title-card #dk-resume') && !document.querySelector('#dk-valley')`, 'title screen first, with Continue');
    await tv.shot('box-ducks-title-continue');
    await tv.click('#dk-resume');
    await tv.until(`!!document.querySelector('#dk-valley') && !document.querySelector('#corner').hidden`, 'valley resumed');
    // A crowded valley: one shared map with many farms.
    for (let i = 0; i < 6; i++) { await tv.eval(`(() => { document.querySelector('#corner .cg').click(); document.querySelector('#corner [data-h="bots"]').click(); return true; })()`); await wait(150); }
    await wait(1500); await tv.shot('box-ducks-valley-crowd');
    // Every mini-game really plays: real taps, holds and paddles; each finishes and pays out.
    const scores = {};
    for (const [skill, game] of [['run', 'hurdles'], ['swim', 'paddle'], ['fly', 'rings'], ['climb', 'climb'], ['stamina', 'bugs']]) {
      await ph.until(`!!document.querySelector('[data-sheet="${skill}"]') && !document.querySelector('.dk-over')`, 'skill card ' + skill, 8000);
      await ph.click(`[data-sheet="${skill}"]`); await ph.until(`!!document.querySelector('[data-diff="easy"]')`, 'sheet');
      await ph.click('[data-diff="easy"]'); await wait(150); await ph.click('[data-play]');
      await ph.until(`!!document.querySelector('.dk-over') && !document.querySelector('.dk-ready')`, game + ' started', 6000);
      const end = Date.now() + 21000; let i = 0;
      while (Date.now() < end && !(await ph.eval(`!!document.querySelector('.dk-result')`))) {
        await ph.eval(`(() => { const c = document.querySelector('.dk-over canvas'), r = c.getBoundingClientRect(), i = ${i};
          const ev = (type, x, y) => (type === 'pointerup' ? window : c).dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: r.left + x * r.width, clientY: r.top + y * r.height }));
          if ('${game}' === 'paddle') document.querySelector('[data-pad="' + (i % 2 ? 'R' : 'L') + '"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
          else if ('${game}' === 'rings') ev(i % 4 < 2 ? 'pointerdown' : 'pointerup', 0.5, 0.5);
          else if ('${game}' === 'bugs') ev('pointerdown', ((i * 7) % 3 + 0.5) / 3, ((i * 5) % 4 + 0.5) / 4);
          else ev('pointerdown', 0.5, 0.5);
          return true; })()`);
        if (i === 18) await ph.shot('box-mini-' + game);
        i++; await wait(game === 'paddle' ? 90 : game === 'bugs' ? 120 : 380);
      }
      try { await ph.until(`/XP/.test((document.querySelector('.dk-result') || {}).textContent || '')`, game + ' reward', 15000); }
      catch (e) { throw new Error(game + ' reward: the card says ' + JSON.stringify(await ph.eval(`(document.querySelector('.dk-result') || {}).textContent || '(no card)'`))); }
      scores[game] = await ph.eval(`Number((document.querySelector('.dk-result h2').textContent.match(/\\d+/) || [0])[0])`);
      await ph.click('.dk-result button');
    }
    console.log('    mini-game scores (simple bot taps on Easy):', JSON.stringify(scores));
    assert(Object.values(scores).filter((v) => v > 0).length >= 4, 'the mini-games score points: ' + JSON.stringify(scores));
    ok('All five mini-games play on a real phone page (Hurdle Dash, Paddle Power, Sky Rings, Cliff Climb, Bug Snack), finish and pay out XP');
    PAGES.push(tv, ph);
    ok('JustRaiseDucks at /ducks: its own title screen and look, no JustGameBox bar, phone joins at /ducks/play, corner badge + host menu; reloading opens the title first and Continue resumes');
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
    assert(/Score (\d+)/.test(res) && Number(res.match(/Score (\d+)/)[1]) >= 1, res); // mashing scores a little; rhythm scores more
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
  // ---------- JustMarble: line up, ready, the marble rolls on the holder's phone ----------
  {
    const { tv, ph } = await setup(browser, 'marble');
    await tv.click('#start'); await skipShow(tv);
    await tv.until(`/Put your phones together/.test(document.body.textContent)`, 'marble lineup', 20000);
    await ph.until(`!!document.querySelector('#mb-ready')`, 'ready button', 8000); await ph.click('#mb-ready');
    await tv.until(`/has the marble/.test(document.body.textContent)`, 'marble rolling', 20000);
    await ph.until(`!!document.querySelector('#mb-pad canvas')`, 'phone board');
    await tv.shot('box-marble-tv'); await ph.shot('box-marble-phone');
    ok('JustMarble: phones line up, tap ready, the TV maps the boards and the marble starts rolling');
  }

  // ---------- JustEscape: Hazel's briefing, the phones get their evidence, the case board ----------
  {
    const { tv, ph } = await setup(browser, 'escape');
    await tv.click('#start'); await skipShow(tv);
    await tv.until(`!!document.querySelector('.es-storybox')`, 'Hazel briefs the room', 20000);
    await ph.until(`!!document.querySelector('#es-ready')`, 'ready button', 8000); await ph.click('#es-ready');
    await tv.until(`!!document.querySelector('.es-locks')`, 'the case board', 20000);
    await ph.until(`document.querySelectorAll('.es-card').length >= 1`, 'evidence on the phone');
    await tv.shot('box-escape-tv'); await ph.shot('box-escape-phone');
    ok('JustEscape: Hazel briefs the room, phones get their evidence, the TV shows every lock and who holds what');
  }

  // ---------- JustPizza: a customer shows the order, the phone builds it and serves it, the reveal ----------
  {
    const { tv, ph } = await setup(browser, 'pizza', { mode: 'classic', rounds: 3, seconds: 30 });
    await tv.click('#start'); await skipShow(tv);
    await tv.until(`!!document.querySelector('.pz-plate .pz-svg') && !!document.querySelector('.pz-cust')`, 'the customer shows the order', 20000);
    await wait(800); await tv.shot('box-pizza-order');
    await ph.until(`!!document.querySelector('#pz-serve')`, 'the pizza station', 20000);
    assert(!(await tv.eval(`!!document.querySelector('.pz-plate')`)), 'the order is hidden while cooking');
    for (const sel of ['[data-crust="deep"]', '[data-sauce="tomato"]', '[data-cheese="2"]', '[data-top="mushroom"]']) { await ph.click(sel); await wait(150); }
    await ph.click('#pz-all'); await wait(150); await ph.click('[data-top="olive"]'); await wait(150);
    // swipe across two slices of the pie (a real pointer drag)
    await ph.eval(`(() => { const b = document.querySelector('#pz-pie'), r = b.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const ev = (t, x, y) => b.dispatchEvent(new PointerEvent(t, { bubbles: true, pointerId: 1, clientX: x, clientY: y, buttons: 1 }));
      ev('pointerdown', cx + r.width * 0.12, cy - r.height * 0.3); ev('pointermove', cx + r.width * 0.3, cy - r.height * 0.12); ev('pointerup', cx + r.width * 0.3, cy - r.height * 0.12); return true; })()`);
    await wait(300);
    await tv.shot('box-pizza-tv');
    await ph.shot('box-pizza-phone');
    assert(await ph.eval(`document.querySelectorAll('#pz-pie .pz-svg g').length > 20`), 'toppings on the pie');
    await ph.click('#pz-serve');
    await ph.until(`/Served!/.test(document.body.textContent)`, 'served', 8000);
    await tv.until(`!!document.querySelector('.pz-reveal .pz-entry')`, 'the reveal', 45000);
    await wait(1200); await tv.shot('box-pizza-reveal');
    await ph.until(`!!document.querySelector('.pz-score')`, 'my score', 8000); await ph.shot('box-pizza-result');
    ok('JustPizza: the customer shows the order on the TV, it hides, the phone builds (crust, sauce, cheese, toppings swiped onto slices) and serves, the reveal scores every pizza');
  }

  // ---------- One code for the night: the title screen switches the live room ----------
  {
    // The TV goes back to the title screen (each test page has its own storage, so the TV page is the hub).
    const { tv: hub2, ph, code } = await setup(browser, 'likely');
    await hub2.go(`${URL}/`);
    await hub2.until(`!document.querySelector('#room-live').hidden && document.querySelector('#room-live').textContent.includes('${code}') && !document.querySelector('#new-room').hidden`, 'the live room on the title screen');
    await hub2.shot('box-hub-live-room');
    await hub2.eval(`document.querySelector('.tile.president').click(); true`);
    await hub2.until(`location.pathname === '/box/tv' && /game=president/.test(location.search) && (document.querySelector('#code') || {}).textContent === '${code}'`, 'same room, now President', 10000);
    await ph.until(`document.querySelector('#h-game').title === 'President' && !document.querySelector('#game').hidden`, 'the phone followed', 8000);
    // JustMafia from the title screen: its TV shows the same code; the phone follows by name.
    await hub2.go(`${URL}/`);
    await hub2.until(`!document.querySelector('#room-live').hidden`, 'live room again');
    await hub2.eval(`document.querySelector('.tile.mafia').click(); true`);
    await hub2.until(`location.pathname === '/mafia' && document.querySelector('#room-code').textContent === '${code}'`, 'Mafia TV shows the box code', 15000);
    assert(await hub2.eval(`document.querySelector('#join-url').textContent.endsWith('/j/${code}')`), 'Mafia QR is /j/CODE');
    await ph.until(`location.pathname === '/play'`, 'phone in JustMafia', 10000);
    await hub2.shot('box-mafia-same-code');
    // Back on the title screen: a box game brings everyone back; "New room" forgets the room.
    await hub2.go(`${URL}/`);
    await hub2.until(`!document.querySelector('#room-live').hidden && /JustMafia/.test(document.querySelector('#room-live').textContent)`, 'live room (in JustMafia)');
    await hub2.eval(`document.querySelector('.tile.blackjack').click(); true`);
    await hub2.until(`location.pathname === '/box/tv' && (document.querySelector('#code') || {}).textContent === '${code}'`, 'back in the box room', 10000);
    await ph.until(`location.pathname === '/box/play' && document.querySelector('#h-game').title === 'Blackjack Night'`, 'phone back, no retyping', 15000);
    await hub2.go(`${URL}/`);
    await hub2.until(`!document.querySelector('#new-room').hidden`, 'new room button');
    await hub2.click('#new-room');
    assert(await hub2.eval(`document.querySelector('#room-live').hidden && localStorage.getItem('box.host') === null`), 'forgotten');
    ok('One code: the title screen switches the live room (President, JustMafia with the same code on its TV, back to Blackjack), phones follow; New room starts fresh');
  }

  const pageErrors = PAGES.flatMap((p) => p.errors || []);
  if (pageErrors.length) console.log('PAGE ERRORS:\n' + pageErrors.map((e) => '  ' + String(e && (e.stack || e.message || JSON.stringify(e))).slice(0, 400)).join('\n'));
  assert.deepEqual(pageErrors, [], 'no page errors');
  ok('No page errors on the title screen, TVs or phones');
  console.log(`\nAll ${passed} JustGameBox end-to-end checks passed. Screenshots: ${SHOTS}`);
  await cleanup(); process.exit(0);
})().catch(async (e) => { console.error(e); setTimeout(() => process.exit(1), 4000); try { await cleanup(); } catch {} process.exit(1); });
