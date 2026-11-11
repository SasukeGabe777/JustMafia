'use strict';
// End-to-end Role Draft in headless Chrome: the TV and two phones (plus bots) go through
// the deck shuffle, vote on role cards live (with a phone refresh in the middle), see the
// result, watch the deck collect, get dealt a secret card and flip it, then the game starts.
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { io } = require('socket.io-client');
const { CHROME, Browser, startServer, cleanup, wait } = require('./cdp');

const PORT = 3987, URL = `http://localhost:${PORT}`;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'mt-e2e');
if (!CHROME) { console.log('SKIP e2e-draft: Chrome not found (set CHROME=path).'); process.exit(0); }
let passed = 0;
const ok = (name) => { passed++; console.log(`  ✓ ${name}`); };
const emit = (s, ev, d = {}) => new Promise((r) => s.emit(ev, d, r));

(async () => {
  await startServer(PORT);
  const host = io(URL, { transports: ['websocket'] }); let tv = null; host.on('host:state', (s) => { tv = s; });
  const room = await emit(host, 'host:create');
  // "Every role" deck, so this checks a real vote (a fresh room's first game is the vote-free tutorial round).
  await emit(host, 'host:action', { type: 'settings', settings: { minPlayers: 3, draftSeconds: 40, draftPool: 'all' } });
  await emit(host, 'host:action', { type: 'addBots', count: 4 });

  const browser = new Browser({ shots: SHOTS, debugPort: 9338 }); await browser.launch();
  const t = await browser.page();
  await t.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await t.go(`${URL}/`); await t.eval(`localStorage.setItem('mt.host', JSON.stringify(${JSON.stringify({ code: room.code, hostKey: room.hostKey })}))`);
  await t.send('Page.reload'); await wait(500);
  await t.until(`!document.querySelector('#lobby').hidden`, 'TV lobby');

  const phones = [];
  for (const name of ['Ana', 'Ben']) {
    const p = await browser.page(); phones.push(p);
    await p.go(`${URL}/play?room=${room.code}`);
    await p.until(`!document.querySelector('#screen-creator').hidden && !document.querySelector('#j-go').disabled`, 'creator');
    await p.eval(`document.querySelector('#j-name').value = '${name}'`); await p.click('#j-go');
    await p.until(`!document.querySelector('#screen-home').hidden`, 'claim'); await p.click('#h-save');
    await p.until(`!document.querySelector('#screen-game').hidden`, 'lobby');
  }
  const [a, b] = phones;
  assert.equal(tv.settings.roleSelection, 'draft', 'Default role selection is the draft');

  // 1) Start: the deck appears and shuffles on every screen; no roles exist yet.
  assert((await emit(host, 'host:action', { type: 'start' })).ok !== false);
  assert.equal((await emit(host, 'host:action', { type: 'start' })).ok, false, 'a second Start is refused');
  await t.until(`!document.querySelector('#draft').hidden && document.querySelectorAll('#draft .deck-card').length === 22`, 'TV deck');
  await a.until(`document.querySelector('.draft-phone .mini-deck')`, 'phone deck');
  await wait(2600); await t.shot('draft-1-deck-tv'); await a.shot('draft-1-deck-phone');
  assert(tv.players.every((p) => !p.role));
  ok('Start opens the deck: it drops, fans and shuffles on the TV and phones (no roles dealt yet)');

  // 2) Vote: every screen shows the same cards with real role info; votes update live.
  await t.until(`document.querySelectorAll('#draft .dc-votes').length > 0`, 'TV vote', 9000);
  await a.until(`document.querySelectorAll('[data-dv]').length > 0`, 'phone vote');
  const cards = tv.draft.cards;
  assert.equal(cards.length, 4, '6 players → 4 cards');
  const phoneCards = await a.eval(`[...document.querySelectorAll('[data-item]')].map((el) => el.dataset.item)`);
  assert.deepEqual(phoneCards, cards, 'phones and TV show the same cards');
  const info = await a.eval(`(() => { const el = document.querySelector('[data-item]'); return { name: el.querySelector('.dc-name').textContent, team: el.querySelector('.dc-team').textContent, text: el.querySelector('.dc-text').textContent, when: el.querySelector('.dc-when').textContent }; })()`);
  const R = require('../public/shared/roles');
  assert.equal(info.text, R.ROLES[cards[0]].blurb, 'card text is the real role description');
  assert(info.name && info.team && info.when);
  await a.click(`[data-dv="${cards[0]}"]`);
  await t.until(`(() => { const c = document.querySelector('#draft .dcard[data-card="${cards[0]}"] .dc-votes b'); return c && Number(c.textContent) >= 1; })()`, 'TV count updates live');
  await a.until(`document.querySelector('[data-dv="${cards[0]}"]').textContent.includes('Voted')`, 'phone shows its vote');
  await b.click(`[data-dv="${cards[1]}"]`); await b.click(`[data-dv="${cards[0]}"]`);
  await wait(300);
  // Refresh a phone mid-vote: the ballot is still there (kept on the server).
  await b.send('Page.reload'); await wait(500);
  await b.until(`document.querySelectorAll('.draft-item.picked').length === 2`, 'ballot survives a refresh');
  await t.shot('draft-2-vote-tv'); await a.shot('draft-2-vote-phone');
  ok(`Vote: same ${cards.length} cards everywhere with real descriptions; live counts; a refreshed phone keeps its votes`);

  await a.click('[data-lock]'); await b.click('[data-lock]');
  await a.until(`document.querySelector('[data-lock]').disabled`, 'locked');
  // 3) Everyone locked in (bots too): the vote closes early and the result shows.
  await t.until(`document.querySelectorAll('#draft .dcard.win').length + document.querySelectorAll('#draft .dcard.out').length === ${cards.length}`, 'result on TV', 12000);
  const drafted = tv.draft.result.roles;
  assert(drafted.length >= 1);
  await wait(1600); await t.shot('draft-3-result-tv'); await a.shot('draft-3-result-phone');
  ok(`All locked in → the vote closes early; drafted: ${drafted.join(', ')}`);

  // 4) Cards go back into the deck, then a secret card is dealt to each phone.
  await t.until(`document.querySelector('#draft h1').textContent.includes('Back into the deck')`, 'collect', 9000);
  await wait(2200); await t.shot('draft-4-collect-tv');
  await a.until(`document.querySelector('.my-card')`, 'card dealt to phone', 9000);
  await t.until(`document.querySelectorAll('#draft .dcard.dealt').length === 6`, 'TV deals a card to everyone');
  assert(!(await a.eval(`document.querySelector('.my-card').classList.contains('up')`)), 'the dealt card starts face down');
  await wait(1500); await t.shot('draft-5-deal-tv'); await a.shot('draft-5-deal-phone');
  const myRole = await a.eval(`document.querySelector('.my-card').dataset.card`);
  const tvText = await t.eval(`document.querySelector('#draft').textContent`);
  assert(!tvText.includes(R.ROLES[myRole].blurb), 'the TV never shows a dealt card face');
  await a.click('.my-card');
  await a.until(`document.querySelector('.my-card').classList.contains('up')`, 'flip');
  await wait(700); await a.shot('draft-6-flipped-phone');
  await t.until(`document.querySelectorAll('#draft .dcard.seen').length === 1`, 'TV shows that Ana looked');
  const comp = tv.composition; for (const k of drafted) assert(comp[k], `${k} is in the game`);
  ok(`Dealt face down; Ana flips her own card (${myRole}); the TV only shows that she looked`);

  // 5) Everyone looked: the game starts with the drafted roles.
  await b.until(`document.querySelector('.my-card')`, 'card dealt to Ben'); await b.click('.my-card');
  await t.until(`document.querySelector('#draft').hidden`, 'draft overlay closes', 9000);
  await a.until(`!document.querySelector('.draft-phone')`, 'phone back to the game');
  assert.equal(tv.phase, 'night');
  ok('Everyone flipped → the draft closes and Night 1 begins');

  for (const [n, p] of [['TV', t], ['Ana', a], ['Ben', b]]) assert.deepEqual(p.errors, [], `${n} page errors: ${p.errors.join('\n')}`);
  ok('No page errors');
  console.log(`All ${passed} role draft end-to-end checks passed. Screenshots: ${SHOTS}`);
  host.close();
})().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => { cleanup(); setTimeout(() => process.exit(), 300).unref(); });
