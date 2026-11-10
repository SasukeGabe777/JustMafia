'use strict';
// End-to-end simulation: boots the server, connects a host and N phone
// clients over real sockets, plays full games with random choices, and
// checks that hidden information never leaks.
//   node tools/simulate.js [players...]   e.g. node tools/simulate.js 5 12 30
const { spawn } = require('child_process');
const path = require('path');
const { io } = require('socket.io-client');
const R = require('../public/shared/roles');

const PORT = 3999;
const URL = `http://localhost:${PORT}`;
const sizes = process.argv.slice(2).map(Number).filter(Boolean);
if (!sizes.length) sizes.push(5, 12, 30);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const emit = (s, ev, data) => new Promise((r) => s.emit(ev, data, r));
let failures = 0;
const fail = (msg) => { failures++; console.error('  ✗ ' + msg); };

async function playGame(n, opts = {}) {
  const host = io(URL, { transports: ['websocket'] });
  const created = await emit(host, 'host:create', {});
  const code = created.code;
  let hostState = null;
  const phases = [];
  host.on('host:state', (st) => {
    hostState = st;
    if (phases[phases.length - 1] !== st.phase) phases.push(st.phase);
    if (st.phase !== 'gameover') {
      for (const p of st.players) if (p.alive && p.role) fail(`host saw role of living player ${p.name} during ${st.phase}`);
    }
  });
  await emit(host, 'host:action', { type: 'settings', settings: { nightSeconds: 20, discussionSeconds: 10, votingSeconds: 20, maxPlayers: 100 } });
  if (opts.preset) {
    await emit(host, 'host:action', { type: 'preset', id: opts.preset });
    await emit(host, 'host:action', { type: 'settings', settings: { discussionSeconds: 10, votingSeconds: 20 } });
  }
  // A second, unauthenticated socket must not be able to act as the Judge.
  const intruder = io(URL, { transports: ['websocket'] });
  const bad = await emit(intruder, 'judge:attach', { code, hostKey: 'wrong' });
  if (bad.ok) fail('judge:attach accepted a wrong host key');
  const badAct = await emit(intruder, 'host:action', { type: 'start' });
  if (badAct.ok !== false) fail('unauthenticated socket could run host actions');
  // Scene controls are Judge-only, validated, and reach the big screen.
  for (const [ev, data] of [['judge:scene', { scene: 'murder', house: 0 }], ['judge:camera', { spot: 'square' }], ['judge:music', { mood: 'eerie' }], ['judge:stop', {}]]) {
    if ((await emit(intruder, ev, data)).ok !== false) fail(`unauthenticated socket could send ${ev}`);
    if ((await emit(host, ev, data)).ok !== false) fail(`the TV socket itself could send ${ev}`);
  }
  intruder.close();
  const checkScenes = async () => {
    if (opts.preset) return;
    const judge = io(URL, { transports: ['websocket'] });
    if (!(await emit(judge, 'judge:attach', { code, hostKey: created.hostKey })).ok) fail('judge could not attach');
    const got = new Promise((r) => host.once('host:scene', r));
    if ((await emit(judge, 'judge:scene', { scene: '<script>', house: 0 })).ok !== false) fail('unknown scene accepted');
    if ((await emit(judge, 'judge:camera', { house: -5 })).ok !== false) fail('bad house accepted');
    if (!(await emit(judge, 'judge:scene', { scene: 'murder', house: 1, outcome: 'protected' })).ok) fail('judge scene rejected');
    const sc = await Promise.race([got, new Promise((r) => setTimeout(() => r(null), 2000))]);
    if (!sc || sc.scene !== 'murder' || sc.outcome !== 'protected' || sc.house !== 1) fail('TV did not receive the scene');
    judge.close();
  };

  const players = [];
  for (let i = 0; i < n; i++) {
    const s = io(URL, { transports: ['websocket'] });
    const r = await emit(s, 'player:join', { code, name: `P${i}`, avatar: {} });
    if (!r.ok) throw new Error('join failed: ' + r.error);
    const pl = { s, id: r.playerId, view: null };
    s.on('player:state', (v) => {
      pl.view = v;
      // Leak checks: nobody sees a living player's role before game over (except own).
      if (v.phase !== 'gameover') {
        for (const p of v.players) if (p.alive && p.role && p.id !== v.you.id) fail(`${v.you.name} saw role of living ${p.name}`);
      }
      if (v.teammates && v.team !== 'mafia') fail(`${v.you.name} (non-mafia) got teammates`);
      if (v.investigations && !['detective', 'sheriff', 'investigator', 'sorcerer', 'jester', 'alchemist', 'mafia', 'godfather', 'silencer', 'hustler', 'roleblocker', 'puppetMaster'].includes(v.role)) fail(`${v.you.name} got investigations`);
      if (v.phase === 'night' && v.mafia && v.mafia.canVote && !v.mafia.choice && v.mafia.targets.length) {
        const target = v.mafia.picks[0] ? v.mafia.picks[0].targetId : v.mafia.targets[0];
        setTimeout(() => s.emit('player:mafiaVote', { targetId:target }), Math.random()*250);
      }
      if (v.phase === 'night' && v.special && v.special.canAct && v.special.mimic) s.emit('player:special',{ op:'mimic',role:'detective' });
      // Act randomly, like a real player would.
      if (v.phase === 'night' && v.action && !v.action.choice && v.action.targets.length) {
        const mate = v.action.teamPicks && v.action.teamPicks[0];
        setTimeout(() => s.emit('player:night', { targetId: mate ? mate.targetId : pick(v.action.targets) }), Math.random() * 300);
      }
      if (v.phase === 'voting' && v.voting && !v.voting.choice) {
        setTimeout(() => s.emit('player:vote', { targetId: Math.random() < 0.1 && v.voting.canSkip ? 'skip' : pick(v.voting.targets) }), Math.random() * 300);
      }
      if (v.ability && v.ability.canUse) {
        const a = v.ability;
        if (a.kind === 'ghostwriter') s.emit('player:ability', { tokens: ['WATCH'] });
        if (a.kind === 'glitch') s.emit('player:ability', {});
        const living = v.players.filter((p) => p.alive && p.id !== v.you.id);
        if (a.kind === 'puppetMaster' && living.length >= 2) s.emit('player:ability', { victimId: living[0].id, targetId: living[1].id });
      }
      if (!v.you.alive && v.phase !== 'lobby' && Math.random() < 0.05) {
        const alive = v.players.filter((p) => p.alive);
        if (alive.length) s.emit('player:haunt', { kind: 'boo', targetId: pick(alive).id });
      }
    });
    players.push(pl);
  }
  await wait(300);
  await checkScenes();
  if (hostState.players.length !== n) fail(`host sees ${hostState.players.length} players, expected ${n}`);

  const start = await emit(host, 'host:action', { type: 'start' });
  if (!start.ok) throw new Error('start failed: ' + start.error);
  await wait(300);

  const roles = players.map((p) => p.view.role);
  const mafia = players.filter((p) => p.view.team === 'mafia').length;
  if (!roles.every(Boolean)) fail('someone has no role');
  for (const p of players.filter((x) => x.view.team === 'mafia')) {
    if (p.view.teammates.length !== mafia - 1) fail('mafia teammate list wrong');
  }

  const t0 = Date.now();
  while (hostState.phase !== 'gameover' && Date.now() - t0 < 240000) await wait(200);
  if (hostState.phase !== 'gameover') fail(`game ${n} did not finish (stuck in ${hostState.phase})`);

  const alive = hostState.players.filter((p) => p.alive);
  const aliveMafia = alive.filter((p) => p.role === 'mafia').length;
  const expected = aliveMafia === 0 ? 'town' : 'mafia';
  if (!opts.preset && hostState.winner !== expected) fail(`winner ${hostState.winner} but expected ${expected}`);
  if (!hostState.players.every((p) => p.role)) fail('roles not revealed at game over');
  for (const inv of players.filter((p) => p.view.investigations)) {
    for (const i of inv.view.investigations) {
      if (!i.blocked && i.reveal !== 'activity' && i.result !== (i.reveal === 'role' ? hostState.players.find((p) => p.id === i.targetId).role : R.investigate(hostState.players.find((p) => p.id === i.targetId).role, i.reveal))) fail(`${inv.view.role} got a wrong result`);
    }
  }

  console.log(`  ✓ ${n} players${opts.preset ? ` (${opts.preset})` : ''} · ${mafia} mafia · ${hostState.winner} wins after day ${hostState.day} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`    phases: ${phases.join(' → ')}`);

  // Back to lobby keeps everyone.
  await emit(host, 'host:action', { type: 'lobby' });
  await wait(200);
  if (hostState.phase !== 'lobby' || hostState.players.some((p) => !p.alive || p.role)) fail('reset to lobby did not clean up');

  players.forEach((p) => p.s.close());
  host.close();
}

(async () => {
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), MT_SPEED: '25' },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  await wait(800);
  try {
    for (const n of sizes) await playGame(n);
    if (!process.argv[2]) { await playGame(10, { preset: 'chaos' }); await playGame(60, { preset: 'bigParty' }); await playGame(16, { preset: 'storytellers' }); await playGame(18, { preset:'cinematicChaos' }); }
  } catch (e) {
    fail(e.stack || String(e));
  } finally {
    server.kill();
  }
  console.log(failures ? `\n${failures} problem(s) found.` : '\nAll simulated games passed.');
  process.exit(failures ? 1 : 0);
})();
