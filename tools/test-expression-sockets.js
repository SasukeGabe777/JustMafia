'use strict';
// Multiplayer check over real sockets: a chosen expression reaches the TV and
// every other phone, survives a refresh (resume) and a rejoin with the same
// profile, and cannot change once the game has started.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { io } = require('socket.io-client');
const PORT = 3995, URL = `http://localhost:${PORT}`;
const sockets = [];
const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: String(PORT), MT_PROFILE_STORE: 'memory' }, stdio: 'pipe' });
let errors = ''; server.stderr.on('data', (b) => { errors += b; });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const socket = () => { const s = io(URL, { transports: ['websocket'], timeout: 3000 }); sockets.push(s); return s; };
const emit = (s, event, data = {}) => new Promise((resolve, reject) => s.timeout(4000).emit(event, data, (err, r) => err ? reject(err) : resolve(r)));
async function until(fn, what) { const end = Date.now() + 5000; while (!fn()) { if (Date.now() > end) throw new Error('Timed out waiting for ' + what); await wait(15); } }
async function phone(code, name, avatar, auth) {
  const s = socket(), me = { s, view: null };
  s.on('player:state', (v) => { me.view = v; });
  me.profile = auth ? (await emit(s, 'profile:resume', auth), auth) : await emit(s, 'profile:create');
  Object.assign(me, await emit(s, 'player:join', { code, name, avatar }));
  assert(me.ok, 'join failed'); return me;
}
const seen = (view, id) => view && view.players.find((p) => p.id === id);
(async () => {
  await new Promise((resolve, reject) => { server.stdout.on('data', (b) => { if (String(b).includes('Mafia Town is running')) resolve(); }); setTimeout(() => reject(new Error('Server did not start: ' + errors)), 5000).unref(); });
  const host = socket(), room = await emit(host, 'host:create'); let tv;
  host.on('host:state', (s) => { tv = s; });
  await emit(host, 'host:action', { type: 'settings', settings: { minPlayers: 3 } });

  const a = await phone(room.code, 'Ana', { hair: 'curly', expression: 'angry' });
  const b = await phone(room.code, 'Ben', { hair: 'short', expression: 'sleepy' });
  await until(() => seen(tv, a.playerId) && seen(b.view, a.playerId), 'players to appear');
  assert.equal(seen(tv, a.playerId).avatar.expression, 'angry');
  assert.equal(seen(b.view, a.playerId).avatar.expression, 'angry');
  assert.equal(seen(a.view, b.playerId).avatar.expression, 'sleepy');

  a.s.emit('player:profile', { name: 'Ana', avatar: { ...seen(tv, a.playerId).avatar, expression: 'wink' } });
  await until(() => seen(tv, a.playerId).avatar.expression === 'wink' && seen(b.view, a.playerId).avatar.expression === 'wink', 'live expression change');

  // Refresh: a brand-new socket resumes the same seat.
  a.s.disconnect(); const r = socket(); let rv; r.on('player:state', (v) => { rv = v; });
  assert((await emit(r, 'player:resume', { code: room.code, token: a.token })).ok);
  await until(() => rv, 'resumed state'); assert.equal(rv.you.avatar.expression, 'wink');

  // Leaving and rejoining a new room with the same profile keeps the saved expression.
  const host2 = socket(), room2 = await emit(host2, 'host:create');
  const again = await phone(room2.code, 'Ana', {}, { id: a.profile.id, token: a.profile.token });
  await until(() => again.view, 'rejoined state'); assert.equal(again.view.you.avatar.expression, 'wink');

  // Locked once the game starts.
  await phone(room.code, 'Cy', { expression: 'grin' });
  assert((await emit(host, 'host:action', { type: 'start' })).ok !== false);
  await until(() => tv.phase !== 'lobby', 'game start');
  b.s.emit('player:profile', { name: 'Ben', avatar: { ...seen(tv, b.playerId).avatar, expression: 'grin' } });
  await wait(200); assert.equal(seen(tv, b.playerId).avatar.expression, 'sleepy');
  console.log('✓ Expression sockets: TV and other phones see changes live; refresh, profile rejoin and start-lock verified.');
})().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => { sockets.forEach((s) => s.close()); server.kill(); });
