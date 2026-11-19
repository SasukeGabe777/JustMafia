'use strict';
// Removing players: the TV (host:action kick) and the host's phone (player:host kick).
//   node tools/test-box-kick.js
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const { GAMES } = require('../box');
const { io } = require('socket.io-client');

let passed = 0;
const ok = (name) => { passed++; console.log('  ✓ ' + name); };

{
  const room = new BoxRoom('KICK', GAMES.likely, { clock: new VirtualClock(), seed: 1 });
  const a = room.join('Ana').player, b = room.join('Ben').player; room.addBots(3);
  b.profileId = 'prof-b';
  assert.equal(room.kick(b.id).ok, true);
  assert(!room.players.has(b.id), 'gone from the room');
  assert(room.isKicked(b.token, null) && room.isKicked(null, 'prof-b'), 'the same phone or account is blocked');
  assert(!room.isKicked(a.token, null));
  assert.equal(room.kick(b.id).ok, false, 'kicking twice is harmless');
  const bot = room.list().find((p) => p.bot); assert(room.kick(bot.id).ok);
  assert(room.start().ok, 'the game still starts');
  const victim = room.list().find((p) => p.bot); assert(room.kick(victim.id).ok, 'kick mid-game');
  assert.equal(room.playerState(a).roster.length, room.players.size - 1, 'the host phone sees everyone else');
  ok('a kicked player leaves, mid-game too; their phone and account are blocked; the host phone gets a roster');
}

const PORT = 3967, URL = `http://127.0.0.1:${PORT}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const emit = (s, ev, msg) => new Promise((res) => s.emit(ev, msg, (r) => res(r)));
const connect = () => new Promise((res, rej) => { const s = io(URL + '/box', { transports: ['websocket'], forceNew: true, reconnection: false }); s.once('connect', () => res(s)); s.once('connect_error', rej); });

(async () => {
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: String(PORT), MT_PROFILE_STORE: 'memory' }, stdio: 'pipe' });
  const socks = [];
  try {
    await new Promise((resolve, reject) => { server.stdout.on('data', (d) => { if (String(d).includes('running')) resolve(); }); setTimeout(() => reject(new Error('server did not start')), 8000).unref(); });
    const tv = await connect(); socks.push(tv);
    const made = await emit(tv, 'host:create', { game: 'likely' }); assert(made.ok);
    const host = await connect(), c = await connect(), d = await connect(); socks.push(host, c, d);
    const jh = await emit(host, 'player:join', { code: made.code, name: 'Host' }); assert(jh.ok);
    const jc = await emit(c, 'player:join', { code: made.code, name: 'Cal' }); assert(jc.ok);
    const jd = await emit(d, 'player:join', { code: made.code, name: 'Dee' }); assert(jd.ok);
    let toldC = false, toldD = false; c.on('kicked', () => { toldC = true; }); d.on('kicked', () => { toldD = true; });
    // Not the host: refused.
    assert.equal((await emit(c, 'player:host', { type: 'kick', id: jd.id })).ok, false);
    assert.equal((await emit(host, 'player:host', { type: 'kick', id: jh.id })).ok, false, 'the host cannot remove themselves');
    // The host's phone removes Cal.
    assert((await emit(host, 'player:host', { type: 'kick', id: jc.id })).ok);
    await wait(100); assert(toldC, 'Cal’s phone is told');
    const back = await emit(c, 'player:join', { code: made.code, name: 'Cal', token: jc.token });
    assert.equal(back.ok, false); assert(back.kicked);
    // The TV removes Dee.
    assert((await emit(tv, 'host:action', { type: 'kick', id: jd.id })).ok);
    await wait(100); assert(toldD, 'Dee’s phone is told');
    ok('over sockets: host phone and TV remove players, the phone is told, the same phone can’t rejoin, others can’t kick');
  } finally { for (const s of socks) try { s.close(); } catch { /* gone */ } server.kill(); }
  console.log(`\nAll ${passed} kick tests passed.`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
