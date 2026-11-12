'use strict';
// Real socket tests: stale sockets, credentials, reconnects, private channels,
// disaster preview/confirm and replacement without resetting a running game.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { io } = require('socket.io-client');
const PORT = 3997, URL = `http://localhost:${PORT}`;
const sockets = [];
const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'pipe' });
let errors = ''; server.stderr.on('data', (b) => { errors += b; });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const socket = () => { const s = io(URL, { transports: ['websocket'], timeout: 3000 }); sockets.push(s); return s; };
const emit = (s, event, data = {}) => new Promise((resolve, reject) => s.timeout(4000).emit(event, data, (err, r) => err ? reject(err) : resolve(r)));
async function until(fn) { const end = Date.now() + 5000; while (!fn()) { if (Date.now() > end) throw new Error('Timed out waiting for state'); await wait(15); } }
(async () => {
  await new Promise((resolve, reject) => { server.once('error', reject); server.stdout.on('data', (b) => { if (String(b).includes('Mafia Town is running')) resolve(); }); setTimeout(() => reject(new Error('Server did not start: ' + errors)), 5000).unref(); });
  const host = socket(), bootstrap = await emit(host, 'host:create'); let state;
  host.on('host:state', (s) => { state = s; });
  const originalJudge = socket(); assert((await emit(originalJudge, 'judge:attach', { code: bootstrap.code, hostKey: bootstrap.hostKey })).ok);
  const malformed = socket();
  for (const payload of [null, false, 'invalid', [], 42]) {
    assert.equal((await emit(malformed, 'judge:attach', payload)).ok, false);
    assert.equal((await emit(malformed, 'player:resume', payload)).ok, false);
  }
  const participants = [];
  for (let i = 0; i < 7; i++) {
    const s = socket(), joined = await emit(s, 'player:join', { code: bootstrap.code, name: `Human ${i}`, avatar: { hair: 'curly', facialHair: 'beard', eyes: '#416f91' } });
    assert(joined.ok); const p = { ...joined, s, view: null }; s.on('player:state', (v) => { p.view = v; }); participants.push(p);
  }
  assert((await emit(host, 'host:action', { type: 'randomJudge' })).ok);
  await until(() => state && state.governance.judgeId && participants.every((p) => p.view));
  const chosen = participants.find((p) => p.playerId === state.governance.judgeId);
  assert(chosen.view.isJudge); assert(chosen.view.you.spectator);
  for (const s of [host, originalJudge]) {
    assert.equal((await emit(s, 'host:action', { type: 'start' })).ok, false);
    assert.equal((await emit(s, 'judge:scene', { scene: 'meteor', house: 0 })).ok, false);
    assert.equal((await emit(s, 'judge:simulate', { games: 1 })).ok, false);
  }
  assert.equal((await emit(originalJudge, 'judge:attach', { code: bootstrap.code, hostKey: bootstrap.hostKey })).ok, false);
  assert.equal((await emit(chosen.s, 'player:removeJudge')).ok, false);
  const judge = socket(); let privateState, judgeUpdates = 0;
  judge.on('judge:state', (v) => { privateState = v; judgeUpdates++; });
  assert((await emit(judge, 'judge:attach', { code: bootstrap.code, token: chosen.token })).ok);
  assert((await emit(judge, 'host:action', { type: 'settings', settings: { roleSelection: 'manual', minPlayers: 3, narratorMode: 'human', autoAdvance: false } })).ok);
  assert((await emit(judge, 'host:action', { type: 'start' })).ok);
  await until(() => privateState && privateState.phase === 'roleReveal');
  assert.equal(privateState.allPlayers.find((p) => p.id === chosen.playerId).role, null);
  const townName = state.townName, day = state.day;
  const target = privateState.allPlayers.find((p) => p.role === 'villager');
  assert(target);
  const house = state.players.find((p) => p.id === target.id).house;
  assert.equal((await emit(judge, 'judge:scene', { scene: 'murder', house: `${house}bad` })).ok, false);
  assert.equal((await emit(judge, 'judge:scene', { scene: 'murder' })).ok, false);
  assert((await emit(judge, 'judge:scene', { scene: 'murder', house, outcome: 'failed' })).ok);
  assert((await emit(judge, 'judge:camera', { spot: 'tavern' })).ok);
  assert.equal(privateState.phase, 'roleReveal'); assert(state.players.find((p) => p.id === target.id).alive);
  assert.equal((await emit(judge, 'host:action', { type: 'disaster', id: target.id, disaster: 'meteor' })).ok, false);
  const preview = await emit(judge, 'host:action', { type: 'disaster', id: target.id, disaster: 'meteor', preview: true }); assert(preview.ok);
  assert.equal(state.players.find((p) => p.id === target.id).alive, true);
  const victim = participants.find((p) => p.playerId === target.id);
  assert.equal((await emit(victim.s, 'host:action', { type: 'disaster', id: target.id, disaster: 'meteor', confirmation: preview.confirmation })).ok, false);
  assert((await emit(judge, 'host:action', { type: 'disaster', id: target.id, disaster: 'meteor', confirmation: preview.confirmation })).ok);
  await until(() => state.players.find((p) => p.id === target.id).alive === false);
  assert.equal(state.cinematic.type, 'disaster'); assert(state.paused);
  assert.equal((await emit(victim.s, 'player:volunteerJudge', { confirmed: false })).ok, false);
  assert((await emit(victim.s, 'player:volunteerJudge', { confirmed: true })).ok);
  const voters = participants.filter((p) => p !== chosen);
  assert.equal(state.governance.required, 5); // ceil(6 * .8)
  assert((await emit(voters[0].s, 'player:removeJudge')).ok);
  assert((await emit(voters[0].s, 'player:removeJudge')).ok);
  await until(() => state.governance.approvals === 1);
  // The Judge cannot shrink the electorate by kicking a supporter mid-petition.
  await emit(judge, 'host:action', { type: 'kick', id: voters[0].playerId });
  await wait(40); assert(state.players.some((p) => p.id === voters[0].playerId));
  for (const p of voters.slice(1, 5)) assert((await emit(p.s, 'player:removeJudge')).ok);
  await until(() => state.governance.judgeId === victim.playerId);
  const revokedCount = judgeUpdates;
  assert.equal(state.phase, 'roleReveal'); assert.equal(state.day, day); assert.equal(state.townName, townName); assert(state.paused);
  assert.equal((await emit(judge, 'host:action', { type: 'resume' })).ok, false);
  assert.equal((await emit(judge, 'judge:camera', { spot: 'overview' })).ok, false);
  assert.equal((await emit(judge, 'judge:attach', { code: bootstrap.code, token: chosen.token })).ok, false);
  const successor = socket();
  assert((await emit(successor, 'judge:attach', { code: bootstrap.code, token: victim.token })).ok);
  assert((await emit(successor, 'host:action', { type: 'resume' })).ok);
  assert((await emit(successor, 'host:action', { type: 'say', text: 'Continuing the same town.' })).ok);
  await wait(200); assert.equal(judgeUpdates, revokedCount, 'revoked Judge received future private state');
  assert.equal(state.phase, 'roleReveal'); assert(!state.paused);
  // Reconnect the public display using its original display credential, with no admin power.
  const display = socket(); assert((await emit(display, 'host:resume', { code: bootstrap.code, hostKey: bootstrap.hostKey })).ok);
  assert.equal((await emit(display, 'host:action', { type: 'start' })).ok, false);
  const human = participants.find((p) => p !== victim && p !== chosen);
  human.s.close(); const reconnected = socket(); let restored;
  reconnected.on('player:state', (v) => { restored = v; });
  assert((await emit(reconnected, 'player:resume', { code: bootstrap.code, token: human.token })).ok);
  await until(() => restored); assert.equal(restored.you.id, human.playerId); assert.equal(restored.you.avatar.hair, 'curly');
  assert(!JSON.stringify(state).includes(victim.token)); assert(!JSON.stringify(restored).includes('judgeKey'));
  // The big screen can always take back control: the game ends, the Judge is revoked, the TV runs the room.
  assert.equal((await emit(human.s.connected ? human.s : reconnected, 'host:reclaim')).ok, false, 'phones cannot');
  assert((await emit(display, 'host:reclaim')).ok);
  await until(() => state.phase === 'lobby' && !state.governance.judgeId);
  assert.equal((await emit(successor, 'host:action', { type: 'say', text: 'still here?' })).ok, false, 'the old Judge console is revoked');
  assert((await emit(display, 'host:action', { type: 'settings', settings: { minPlayers: 3 } })).ok, 'the TV controls the room again');
  assert((await emit(socket(), 'judge:attach', { code: bootstrap.code, hostKey: bootstrap.hostKey })).ok, 'the TV’s Judge console link works again');
  assert.equal(errors, ''); console.log('  ✓ Real sockets: election, role exclusion, disaster confirmation, ghost votes, 80% removal, credential and channel revocation, replacement, display and phone reconnects');
})().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => { sockets.forEach((s) => s.close()); server.kill(); });
