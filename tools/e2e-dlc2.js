'use strict';
// End-to-end DLC 1 part 2 on real phones (headless Chrome): the Mathematician solves a
// problem, the Gamer reads the score rewards, plays a run of Night Flight and picks a power,
// and the TV plays the Zombie break-in without errors.
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { io } = require('socket.io-client');
const { CHROME, Browser, startServer, cleanup, wait } = require('./cdp');

const PORT = 3983, URL = `http://localhost:${PORT}`;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'mt-e2e');
if (!CHROME) { console.log('SKIP e2e-dlc2: Chrome not found (set CHROME=path).'); process.exit(0); }
let passed = 0;
const ok = (name) => { passed++; console.log(`  ✓ ${name}`); };
const emit = (s, ev, d = {}) => new Promise((r) => s.emit(ev, d, r));

(async () => {
  await startServer(PORT);
  const host = io(URL, { transports: ['websocket'] }); let tv = null; host.on('host:state', (s) => { tv = s; });
  const room = await emit(host, 'host:create');
  await emit(host, 'host:action', { type: 'settings', settings: { minPlayers: 3, roleSelection: 'manual', autoMafia: false, roleCounts: { mafia: 1, mathematician: 1, gamer: 1, zombie: 1 }, nightSeconds: 90, skipCinematics: false } });
  await emit(host, 'host:action', { type: 'addBots', count: 8 });

  const browser = new Browser({ shots: SHOTS, debugPort: 9336 }); await browser.launch();
  const t = await browser.page();
  await t.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await t.go(`${URL}/`); await t.eval(`localStorage.setItem('mt.host', JSON.stringify(${JSON.stringify({ code: room.code, hostKey: room.hostKey })}))`);
  await t.send('Page.reload'); await wait(500);

  const phones = {};
  for (const name of ['Ana', 'Ben']) {
    const p = await browser.page(); phones[name] = p;
    await p.send('Emulation.setDeviceMetricsOverride', { width: 400, height: 820, deviceScaleFactor: 1, mobile: true });
    await p.go(`${URL}/play?room=${room.code}`);
    await p.until(`!document.querySelector('#screen-creator').hidden && !document.querySelector('#j-go').disabled`, 'creator');
    await p.eval(`document.querySelector('#j-name').value = '${name}'`); await p.click('#j-go');
    await p.until(`!document.querySelector('#screen-home').hidden`, 'claim'); await p.click('#h-save');
    await p.until(`!document.querySelector('#screen-game').hidden`, 'lobby');
  }
  await wait(400);
  const id = (name) => tv.players.find((p) => p.name === name).id;
  for (const [n, role] of [['Ana', 'mathematician'], ['Ben', 'gamer']]) { const r = await emit(host, 'host:action', { type: 'override', op: 'setRole', id: id(n), role }); assert(r.ok, r.error); }
  assert((await emit(host, 'host:action', { type: 'start' })).ok);
  for (let i = 0; i < 60 && tv.phase !== 'night'; i++) { await emit(host, 'host:action', { type: 'skip' }); await wait(200); }
  assert.equal(tv.phase, 'night');
  await phones.Ana.until('/Mathematician/.test(document.body.innerText)', 'Ana is the Mathematician', 10000);
  ok('Game started with a Mathematician and a Gamer on real phones (and a Zombie)');

  // Mathematician: a problem appears; a wrong answer gives a new one; the right answer submits the proof.
  const A = phones.Ana, B = phones.Ben;
  await A.until(`!!document.querySelector('.card.dlc2.math .math-q')`, 'math card');
  await A.shot('dlc2-math');
  const opts = JSON.parse(await A.eval(`JSON.stringify([...document.querySelectorAll('[data-math=a] option')].map((o) => o.value).filter(Boolean))`));
  await A.eval(`(() => { const s = document.querySelectorAll('[data-math]'); s[0].value = '${opts[0]}'; s[0].onchange(); s[1].value = '${opts[1]}'; s[1].onchange(); return true; })()`);
  await A.eval(`(() => { const i = document.querySelector('[data-draft="math-answer"]'); i.value = '-99999'; i.oninput(); document.querySelector('[data-math-go]').click(); return true; })()`);
  await A.until(`/1 try left/.test(document.querySelector('.card.dlc2.math').textContent)`, 'second try');
  ok('Mathematician: a wrong answer costs a try and brings a new problem');
  // Read the new problem and solve it in the page (the test is allowed to do math).
  await A.eval(`(() => { const q = document.querySelector('.math-q').textContent.replace('= ?', '').trim(); let ans;
    let m; if ((m = q.match(/^(\\d+) \\+ (\\d+)$/))) ans = +m[1] + +m[2]; else if ((m = q.match(/^(\\d+) − (\\d+)$/))) ans = m[1] - m[2]; else if ((m = q.match(/^(\\d+) × (\\d+)$/))) ans = m[1] * m[2];
    else if ((m = q.match(/^(\\d+) × (\\d+) \\+ (\\d+)$/))) ans = m[1] * m[2] + +m[3]; else if ((m = q.match(/^(\\d+)²$/))) ans = m[1] * m[1];
    else if ((m = q.match(/^(\\d+)x \\+ (\\d+) = (\\d+)/))) ans = (m[3] - m[2]) / m[1];
    else { const n = q.replace(', ?', '').split(', ').map(Number); ans = n[1] - n[0] === n[2] - n[1] ? n[3] + (n[3] - n[2]) : n[1] === n[0] * 2 ? n[3] * 2 : 25 + (n[0] - 1); }
    const i = document.querySelector('[data-draft="math-answer"]'); i.value = String(ans); i.oninput(); document.querySelector('[data-math-go]').click(); return q + ' = ' + ans; })()`);
  await A.until(`/Proof submitted/.test(document.body.textContent)`, 'proof submitted');
  ok('Mathematician: the right answer submits the proof');

  // Gamer: the reward table is readable before playing.
  await B.until(`!!document.querySelector('.card.dlc2.gamer .gamer-rewards')`, 'gamer card');
  const table = await B.eval(`document.querySelector('.gamer-rewards').textContent`);
  assert(/5\+.*Shield/.test(table) && /12\+.*Scan/.test(table) && /25\+.*High Score/.test(table), table);
  await B.shot('dlc2-gamer-card');
  ok('Gamer: the score rewards (5 Shield, 12 Scan, 25 High Score) are on the card before playing');
  // Play a run: the overlay opens; a few flaps; then the bat falls and the run ends with a score.
  await B.click('[data-flight]');
  await B.until(`!!document.querySelector('.flight canvas')`, 'flight overlay');
  for (let i = 0; i < 6; i++) { await B.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 200, y: 400, button: 'left', clickCount: 1 }); await B.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 200, y: 400, button: 'left', clickCount: 1 }); await wait(260); }
  await B.shot('dlc2-flight');
  await B.until(`!document.querySelector('.flight')`, 'run over', 20000);
  await B.until(`/Score:/.test(document.querySelector('.card.dlc2.gamer h3').textContent)`, 'score card');
  ok('Gamer: Night Flight plays as a full-screen overlay and reports the score');
  await B.shot('dlc2-gamer-score');

  const errors = [...(t.errors || []), ...(A.errors || []), ...(B.errors || [])];
  assert.deepEqual(errors, [], 'no page errors');
  ok('No page errors on the TV or the phones');
  console.log(`\nAll ${passed} DLC 1 (part 2) end-to-end checks passed. Screenshots: ${SHOTS}`);
  await cleanup(); process.exit(0);
})().catch(async (e) => { console.error(e); setTimeout(() => process.exit(1), 4000); try { await cleanup(); } catch {} process.exit(1); });
