'use strict';
// End-to-end check of the vote execution with interventions, in headless Chrome:
// Ana (Role Blocker, on a real phone) interrupts Ben's execution. Different players
// see different options, the TV cue never identifies the interrupter, a reconnect
// keeps Ana's choice, and the outcome is decided before the scene.
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { io } = require('socket.io-client');
const { CHROME, Browser, startServer, cleanup, wait } = require('./cdp');

const PORT = 3990, URL = `http://localhost:${PORT}`;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'mt-e2e');
if (!CHROME) { console.log('SKIP e2e-execution: Chrome not found (set CHROME=path).'); process.exit(0); }
let passed = 0;
const ok = (name) => { passed++; console.log(`  ✓ ${name}`); };
const emit = (s, ev, d = {}) => new Promise((r) => s.emit(ev, d, r));

(async () => {
  await startServer(PORT);
  const host = io(URL, { transports: ['websocket'] }); let tv = null; host.on('host:state', (s) => { tv = s; });
  const room = await emit(host, 'host:create');
  const others = {};
  for (const name of ['Ben', 'Cy', 'Di', 'Eve']) { const s = io(URL, { transports: ['websocket'] }); s.on('player:state', (v) => { s.view = v; }); await emit(s, 'profile:create'); const r = await emit(s, 'player:join', { code: room.code, name }); s.id_ = r.playerId; others[name] = s; }
  const browser = new Browser({ shots: SHOTS, debugPort: 9337 }); await browser.launch();
  const a = await browser.page();
  await a.go(`${URL}/play?room=${room.code}`);
  await a.until(`!document.querySelector('#screen-creator').hidden && !document.querySelector('#j-go').disabled`, 'creator');
  await a.eval(`document.querySelector('#j-name').value = 'Ana'`); await a.click('#j-go');
  await a.until(`!document.querySelector('#screen-home').hidden`, 'claim'); await a.click('#h-save');
  await a.until(`!document.querySelector('#screen-game').hidden`, 'lobby');
  for (let i = 0; i < 50 && !(tv && tv.players.length === 5); i++) await wait(50);
  const id = (n) => tv.players.find((p) => p.name === n).id;
  // Roles for the test: Ana = Role Blocker, Di = Mafia, Ben and Cy = villagers. Votes are public.
  await emit(host, 'host:action', { type: 'settings', settings: { minPlayers: 4, autoMafia: false, roleCounts: { mafia: 1, roleblocker: 1 }, anonymousVotes: false, forcedRoles: { [id('Ana')]: 'roleblocker', [id('Di')]: 'mafia', [id('Ben')]: 'villager', [id('Cy')]: 'villager', [id('Eve')]: 'villager' } } });
  const started = await emit(host, 'host:action', { type: 'start' }); assert(started.ok !== false, 'start: ' + JSON.stringify(started));
  for (let i = 0; i < 12 && tv.phase !== 'voting'; i++) { await emit(host, 'host:action', { type: 'skip' }); await wait(120); }
  assert.equal(tv.phase, 'voting');
  for (const n of ['Cy', 'Di', 'Eve']) others[n].emit('player:vote', { targetId: id('Ben') });
  await a.until(`[...document.querySelectorAll('[data-vote]')].length > 0`, 'Ana can vote');
  await a.click(`[data-vote="${id('Ben')}"]`);
  await wait(300); await emit(host, 'host:action', { type: 'closeVoting' });
  for (let i = 0; i < 40 && tv.phase !== 'verdict'; i++) await wait(50);
  assert.equal(tv.phase, 'verdict');

  // Same moment, different information: only Ana (Role Blocker) can interrupt; only Ben gets last words.
  await a.until(`document.querySelector('[data-intervene="interrupt"]')`, 'Ana sees Interrupt');
  for (let i = 0; i < 40 && !(others.Ben.view && others.Ben.view.verdict && others.Cy.view && others.Cy.view.verdict); i++) await wait(50);
  assert(others.Ben.view.verdict.isCondemned && others.Ben.view.verdict.lastWords, 'Ben (condemned) gets last words');
  assert(!others.Cy.view.verdict.canInterrupt && !others.Cy.view.verdict.lastWords && others.Cy.view.verdict.canDefend, 'Cy can only defend');
  assert(!('verdict' in tv), 'the TV gets no verdict options');
  await a.shot('verdict-roleblocker');
  ok('Same verdict, different information: Role Blocker sees Interrupt, the condemned gets last words, others can defend, TV gets none');

  // Ana interrupts on her phone; Cy defends; Ben picks last words. Reconnect keeps Ana's choice.
  await a.click('[data-intervene="interrupt"]');
  await a.until(`document.querySelector('[data-intervene="interrupt"]').classList.contains('sel')`, 'choice shown');
  others.Cy.emit('player:intervene', { kind: 'defend' });
  others.Ben.emit('player:lastWords', { nameId: id('Di'), word: 'LIAR' });
  await a.send('Page.reload'); await wait(500);
  await a.until(`!document.querySelector('#screen-game').hidden && document.querySelector('[data-intervene="interrupt"].sel')`, 'choice survives reconnect');
  ok('Ana interrupts from her phone; her choice survives a reconnect');

  // The server resolves before the scene: Ben lives; the public cue never names the interrupter.
  await emit(host, 'host:action', { type: 'skip' });
  for (let i = 0; i < 40 && tv.phase !== 'execution'; i++) await wait(50);
  const cue = tv.cinematic;
  assert.equal(cue.outcome, 'interrupted'); assert.equal(tv.players.find((p) => p.name === 'Ben').alive, true);
  assert(!JSON.stringify({ ...cue, mob: null }).includes(id('Ana')), 'interrupter never identified');
  assert.deepEqual(cue.mob.slice().sort(), [id('Ana'), id('Cy'), id('Di'), id('Eve')].sort(), 'public votes: the mob is the real voters');
  assert.deepEqual(cue.defenders, [id('Cy')]); assert.equal(cue.lastWords, null, 'no last words when nobody died');
  assert(!/Role Blocker|roleblocker|Ana/.test(JSON.stringify(tv.narration || '')), 'narration does not name the interrupter');
  ok('Outcome decided on the server (interrupted, Ben lives); the TV cue and narration never identify Ana');

  // Skipping the scene doesn't change anything; the game moves on; Ana can't interrupt again this game.
  await emit(host, 'host:action', { type: 'skip' });
  for (let i = 0; i < 40 && tv.phase === 'execution'; i++) await wait(50);
  assert.notEqual(tv.phase, 'execution'); assert.equal(tv.players.find((p) => p.name === 'Ben').alive, true);
  ok('Skipping the execution scene keeps the outcome and the game moves on');

  assert.deepEqual(a.errors, [], 'page errors: ' + a.errors.join('\n'));
  ok('No page errors');
  console.log(`All ${passed} execution end-to-end checks passed. Screenshots: ${SHOTS}`);
  host.close();
})().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => { cleanup(); setTimeout(() => process.exit(), 300).unref(); });
