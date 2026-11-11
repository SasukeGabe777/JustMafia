'use strict';
// End-to-end check of the end-of-game gold reward scene in headless Chrome:
// three human players finish a game, the phone shows coins flying into the pouch
// with a breakdown, the balance updates and persists, and it plays only once.
// Run with `npm run test:e2e` (the private server shortens the minimum game length).
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { io } = require('socket.io-client');
const { CHROME, Browser, startServer, cleanup, wait } = require('./cdp');

const PORT = 3991, URL = `http://localhost:${PORT}`;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'mt-e2e');
if (!CHROME) { console.log('SKIP e2e-rewards: Chrome not found (set CHROME=path).'); process.exit(0); }
let passed = 0;
const ok = (name) => { passed++; console.log(`  ✓ ${name}`); };
const emit = (s, ev, d = {}) => new Promise((r) => s.emit(ev, d, r));

(async () => {
  await startServer(PORT, { MT_REWARD_MIN_MS: '0' });
  const host = io(URL, { transports: ['websocket'] }); let tv = null; host.on('host:state', (s) => { tv = s; });
  const room = await emit(host, 'host:create');
  await emit(host, 'host:action', { type: 'settings', settings: { minPlayers: 3, roleSelection: 'manual' } });
  // Two other humans on their own "phones" (sockets with their own profiles).
  for (const name of ['Ben', 'Cy']) { const s = io(URL, { transports: ['websocket'] }); await emit(s, 'profile:create'); assert((await emit(s, 'player:join', { code: room.code, name })).ok); }

  const browser = new Browser({ shots: SHOTS, debugPort: 9336 }); await browser.launch();
  const a = await browser.page();
  await a.go(`${URL}/play?room=${room.code}`);
  await a.until(`!document.querySelector('#screen-creator').hidden && !document.querySelector('#j-go').disabled`, 'creator');
  await a.eval(`document.querySelector('#j-name').value = 'Ana'`); await a.click('#j-go');
  await a.until(`!document.querySelector('#screen-home').hidden`, 'claim'); await a.click('#h-save');
  await a.until(`!document.querySelector('#screen-game').hidden && document.querySelector('#g-pouch')`, 'lobby');
  const startGold = await a.eval(`Number(document.querySelector('#g-pouch b').textContent)`); assert.equal(startGold, 0);

  // Play to the end: the host removes the Mafia, the town wins.
  assert((await emit(host, 'host:action', { type: 'start' })).ok !== false);
  await a.until(`document.querySelector('#g-body [data-role]')`, 'game started');
  // 3 players, 1 Mafia: removing Ben (then Cy if needed) always ends the game, with Ana alive.
  for (const name of ['Ben', 'Cy']) {
    if (tv.phase === 'gameover') break;
    await emit(host, 'host:action', { type: 'override', op: 'kill', id: tv.players.find((p) => p.name === name).id });
    await wait(300);
  }
  await a.until(`!document.querySelector('#reward-scene').hidden`, 'reward scene opens after the game', 15000);
  ok('A completed game opens the reward scene on the phone');

  // Mid-animation: coins in flight, lines revealing; the header pouch still shows the old balance.
  await wait(1200); await a.shot('reward-mid');
  assert.equal(await a.eval(`Number(document.querySelector('#g-pouch b').textContent)`), startGold, 'header pouch waits for the coins');
  await a.until(`document.querySelector('#reward-scene').dataset.done === '1'`, 'animation finishes', 15000);
  const r = await a.eval(`(() => { const box = document.querySelector('#reward-scene'); return { total: Number(box.dataset.total), shown: Number(box.querySelector('[data-reward-shown]').textContent), lines: [...box.querySelectorAll('[data-line]')].map((li) => [li.querySelector('span').textContent, Number(li.querySelector('b').textContent)]), title: box.querySelector('h2').textContent }; })()`);
  assert.equal(r.title, 'Gold earned!'); assert(r.total > 0, 'earned gold');
  assert.equal(r.shown, startGold + r.total, 'counter lands on the new balance');
  assert(r.lines.some(([label]) => /Finished the game/.test(label)), 'breakdown lists where the gold came from');
  const sum = r.lines.reduce((t, [, n]) => t + n, 0); assert(sum >= r.total);
  await a.shot('reward-done');
  ok(`Coins animate into the pouch; breakdown (${r.lines.map(([l, n]) => `${l} +${n}`).join(', ')}) totals +${r.total}`);

  // Close: the pouch shows the new balance; it persists after a refresh; the scene doesn't replay by itself.
  await a.click('[data-reward-close]');
  await a.until(`Number(document.querySelector('#g-pouch b').textContent) === ${startGold + r.total}`, 'pouch updated');
  await a.send('Page.reload'); await wait(500);
  await a.until(`!document.querySelector('#screen-game').hidden && document.querySelector('#g-pouch') && Number(document.querySelector('#g-pouch b').textContent) === ${startGold + r.total}`, 'balance after refresh');
  await wait(3200); assert(await a.eval(`document.querySelector('#reward-scene').hidden`), 'does not auto-replay after refresh');
  await a.click('[data-reward-replay]'); await a.until(`!document.querySelector('#reward-scene').hidden`, 'replay button');
  await a.until(`document.querySelector('#reward-scene').dataset.done === '1'`, 'replay finishes', 15000);
  assert.equal(await a.eval(`Number(document.querySelector('[data-reward-shown]').textContent)`), startGold + r.total, 'replay does not pay twice');
  ok('Balance persists after refresh; the scene plays once and can be replayed without paying again');

  // The optional Rundown on the big screen: hidden until someone clicks it.
  const t = await browser.page();
  await t.go(`${URL}/`); await t.eval(`localStorage.setItem('mt.host', JSON.stringify(${JSON.stringify({ code: room.code, hostKey: room.hostKey })}))`);
  await t.send('Page.reload'); await wait(500);
  await t.until(`!document.querySelector('#gameover').hidden`, 'TV game-over screen');
  // "You just unlocked!": the next tier's cards float in and flip; then Play again / See results.
  const T1 = require('../public/shared/draft').TIER[1];
  await t.until(`!document.querySelector('#unlock').hidden && document.querySelectorAll('#unlock-cards .dcard').length === ${T1.length}`, 'unlock reveal', 9000);
  await t.until(`document.querySelectorAll('#unlock-cards .dcard.up').length === ${T1.length}`, 'cards flip over', 8000);
  const unlocked = await t.eval(`[...document.querySelectorAll('#unlock-cards .dcard')].map((c) => c.dataset.card)`);
  assert.deepEqual(unlocked, T1, 'the first game (the tutorial round) unlocks tier 1');
  await wait(1200); await t.shot('tv-unlock');
  await t.click('#unlock-close'); assert(await t.eval(`document.querySelector('#unlock').hidden`));
  ok('Game over: “You just unlocked!” floats in the next tier’s cards and flips them');
  assert(await t.eval(`document.querySelector('#rundown').hidden`), 'rundown stays hidden unless asked for');
  await t.click('#go-rundown');
  await t.until(`!document.querySelector('#rundown').hidden && document.querySelectorAll('#rd-body .rd-chapter').length > 0`, 'rundown opens');
  const rd = await t.eval(`({ head: document.querySelector('#rd-headline').textContent, cast: document.querySelectorAll('#rd-body .rd-cast li').length, text: document.querySelector('#rd-body').textContent })`);
  assert.match(rd.head, /won|Nobody/); assert.equal(rd.cast, 3); assert(/Ben|Cy/.test(rd.text) && !/undefined/.test(rd.text));
  assert(/removed by the Judge/.test(rd.text), 'host/Judge removals are part of the story: ' + rd.text);
  await wait(3500); await t.shot('tv-rundown');
  await t.click('#rd-close'); assert(await t.eval(`document.querySelector('#rundown').hidden`));
  // The Judge can put it up on the TV remotely, and take it down.
  const judge = io(URL, { transports: ['websocket'] }); assert((await emit(judge, 'judge:attach', { code: room.code, hostKey: room.hostKey })).ok);
  assert((await emit(judge, 'room:rundown', { toTv: true })).ok); await t.until(`!document.querySelector('#rundown').hidden`, 'judge shows it on TV');
  assert((await emit(judge, 'room:rundown', { toTv: false })).ok); await t.until(`document.querySelector('#rundown').hidden`, 'judge hides it');
  judge.close();
  assert.deepEqual(t.errors, [], 'TV page errors: ' + t.errors.join('\n'));
  ok(`TV "Rundown of the game" tells the story (${rd.head}); the Judge can show/hide it on the TV`);

  assert.deepEqual(a.errors, [], 'page errors: ' + a.errors.join('\n'));
  ok('No page errors');
  console.log(`All ${passed} reward end-to-end checks passed. Screenshots: ${SHOTS}`);
  host.close();
})().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => { cleanup(); setTimeout(() => process.exit(), 300).unref(); });
