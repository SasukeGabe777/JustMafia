'use strict';
// JustGameBox audience mode and the streamer text filter: watchers join a running game
// (or a full / locked room), vote for the audience favourite (a party-point bonus), react,
// and "play next" watchers become players at the next lobby. 150 watchers over real sockets
// get one compact shared state and stay out of the game's player lists.
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { VirtualClock } = require('../clock');
const { BoxRoom, FAV_BONUS, cleanText } = require('../box/room');
const { GAMES } = require('../box');
const { io } = require('socket.io-client');

let passed = 0;
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
function runOut(r, clock, limit = 400000) { let i = 0; while (r.game.phase !== 'over' && clock.step()) if (++i > limit) throw new Error('game never ended'); }

test('busy(): a running game, a full room or a locked room; the lobby and the end screen are open', () => {
  const clock = new VirtualClock(), r = new BoxRoom('AUDI', GAMES.likely, { clock, seed: 1 });
  r.join('Ana'); r.addBots(4);
  assert.equal(r.busy(), null);
  assert(r.start().ok); assert.equal(r.busy(), 'running');
  runOut(r, clock); assert.equal(r.busy(), null, 'game over: open again');
  r.hostAction({ type: 'lockRoom', on: true }); assert.equal(r.busy(), 'locked'); assert.equal(r.tvState().locked, true);
  r.hostAction({ type: 'lockRoom', on: false }); assert.equal(r.busy(), null);
});

test('Audience members are not players; play-next ones join at the next lobby with the same token', () => {
  const clock = new VirtualClock(), r = new BoxRoom('AUDI', GAMES.likely, { clock, seed: 1 });
  r.join('Ana'); r.addBots(4); assert(r.start().ok);
  const w = r.joinAudience('Wes', null, '🦄', false).member, n = r.joinAudience('Ana', null, '🐸', true).member;
  w.sockets = 1; n.sockets = 1;
  assert.equal(r.players.size, 5, 'not in the player list'); assert.equal(r.audienceCount(), 2);
  assert.equal(r.tvState().audience.count, 2); assert.equal(r.tvState().players.length, 5);
  assert(r.joinAudience('x', w.token).back, 'the same token comes back as the same watcher');
  runOut(r, clock); r.flush();
  assert(r.switchGame(GAMES.price).ok);
  assert.equal(r.players.size, 6, 'the play-next watcher joined');
  const p = r.list().find((x) => x.token === n.token); assert(p, 'same token'); assert.equal(p.name, 'Ana 2', 'a taken name gets a number'); assert.equal(p.avatar, '🐸');
  assert(r.audience.has(w.id) && !r.audience.has(n.id));
  r.setPlayNext(w, true); assert.equal(r.players.size, 7, 'in the lobby, play-next joins at once');
});

test('Audience favourite: a poll at the end of each game; the winner gets a party-point bonus', () => {
  const clock = new VirtualClock(), r = new BoxRoom('AUDI', GAMES.price, { clock, seed: 7 });
  r.join('Ana'); r.addBots(4); assert(r.start().ok);
  const crowd = Array.from({ length: 5 }, (_, i) => { const a = r.joinAudience('W' + i).member; a.sockets = 1; return a; });
  runOut(r, clock); r.flush();
  const P = r.pollView(); assert(P, 'the poll opened'); assert.equal(P.kind, 'fav'); assert.equal(P.options.length, 5);
  const pick = P.options[P.options.length - 1].id, before = r.party.get(pick).pts;
  for (const a of crowd.slice(0, 3)) assert(r.vote(a, pick).ok);
  assert(r.vote(crowd[3], P.options[0].id).ok); assert.equal(r.vote(crowd[4], 'nope').ok, false);
  assert.equal(r.pollView().counts[pick], 3);
  r.vote(crowd[3], pick); assert.equal(r.pollView().votes, 4, 'changing a vote does not add one');
  for (let i = 0; i < 200 && r.poll; i++) clock.step();
  assert.equal(r.poll, null, 'closed after its time');
  assert.equal(r.party.get(pick).pts, before + FAV_BONUS);
  assert.equal(r.played.at(-1).fav.id, pick);
  assert(r.fxLog.some((f) => f.kind === 'audFav'));
});

test('No audience, no poll; switching game closes an open poll', () => {
  const clock = new VirtualClock(), r = new BoxRoom('AUDI', GAMES.price, { clock, seed: 7 });
  r.join('Ana'); r.addBots(3); assert(r.start().ok); runOut(r, clock); r.flush();
  assert.equal(r.poll, null);
  const a = r.joinAudience('W').member; a.sockets = 1;
  assert(r.openPoll({ q: 'Best hat?', options: [{ id: 'x', label: 'X' }, { id: 'y', label: 'Y' }] }).ok);
  let res = null; r.poll.onClose = (x) => { res = x; };
  r.vote(a, 'y'); assert(r.switchGame(GAMES.likely).ok);
  assert.equal(r.poll, null); assert.equal(res.winner.id, 'y');
  assert.equal(r.openPoll({ q: 'One?', options: [{ id: 'a' }] }).ok, false);
});

test('Filter: swear words and slurs covered; harmless words kept; room.cleanText only when on', () => {
  assert.notEqual(cleanText('what the fuck'), 'what the fuck');
  assert.equal(cleanText('Scunthorpe classic cocktail'), 'Scunthorpe classic cocktail');
  assert.equal(cleanText('sh1t'), 's@$%');
  const r = new BoxRoom('FILT', GAMES.likely, { clock: new VirtualClock() });
  assert.equal(r.cleanText('oh shit'), 'oh shit', 'off by default');
  r.hostAction({ type: 'streamer', filter: true }); assert.equal(r.cleanText('oh shit'), 'oh s@$%');
  assert.equal(r.tvState().filterOn, true);
  assert.equal(r.join('fuckface').player.name.startsWith('f@'), true, 'names are cleaned while the filter is on');
});

// ---- over real sockets (box/index.js) ----
const PORT = 3961, URL = `http://127.0.0.1:${PORT}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const emit = (s, ev, msg) => new Promise((res) => s.emit(ev, msg, (r) => res(r)));
const connect = () => new Promise((res, rej) => { const s = io(URL + '/box', { transports: ['websocket'], forceNew: true, reconnection: false }); s.once('connect', () => res(s)); s.once('connect_error', rej); });

async function socketTests() {
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: String(PORT), MT_PROFILE_STORE: 'memory' }, stdio: 'pipe' });
  const socks = [];
  try {
    await new Promise((resolve, reject) => { server.stdout.on('data', (b) => { if (String(b).includes('running')) resolve(); }); setTimeout(() => reject(new Error('server did not start')), 8000).unref(); });
    const tv = await connect(); socks.push(tv);
    const made = await emit(tv, 'host:create', { game: 'likely' });
    assert(made.ok);
    let tvAud = null; tv.on('aud', (a) => { tvAud = a; });
    let tvState = null; tv.on('tv', (s) => { tvState = s; });
    const host = await connect(); socks.push(host);
    const hj = await emit(host, 'player:join', { code: made.code, name: 'Host' }); assert(hj.ok && !hj.audience);
    await emit(tv, 'host:action', { type: 'addBots', count: 4 });
    await wait(80);
    let check = await emit(host, 'room:check', { code: made.code }); assert.equal(check.busy, null);
    // A watcher in the lobby, by choice.
    const early = await connect(); socks.push(early);
    const ej = await emit(early, 'player:join', { code: made.code, name: 'Eve', mode: 'watch' }); assert(ej.ok && ej.audience);
    assert(await emit(tv, 'host:action', { type: 'start' }));
    await wait(50);
    check = await emit(host, 'room:check', { code: made.code }); assert.equal(check.busy, 'running');
    // Mid-game joiners must choose.
    const late = await connect(); socks.push(late);
    const lj = await emit(late, 'player:join', { code: made.code, name: 'Lou' }); assert.equal(lj.ok, false); assert.equal(lj.busy, 'running');
    const lj2 = await emit(late, 'player:join', { code: made.code, name: 'Lou', mode: 'next' }); assert(lj2.ok && lj2.audience && lj2.playNext);
    let promoted = null; late.on('promoted', (m) => { promoted = m; });
    // 150 watchers: one compact shared state each, no player-list growth.
    const crowd = [];
    for (let i = 0; i < 150; i++) crowd.push(connect().then(async (s) => { socks.push(s); let got = 0, bytes = 0; s.on('aud', (st) => { got++; bytes = JSON.stringify(st).length; }); const r = await emit(s, 'player:join', { code: made.code, name: 'Fan' + i, mode: 'watch' }); assert(r.ok && r.audience, 'fan ' + i); return { s, r, got: () => got, bytes: () => bytes }; }));
    const fans = await Promise.all(crowd);
    await wait(600);
    assert.equal(tvAud.audience, 152, 'the TV sees the live audience count');
    assert.equal(tvState.players.length, 5, 'watchers are not players');
    const sizes = fans.map((f) => f.bytes()).filter(Boolean); assert(sizes.length > 140, 'fans got the shared state'); assert(Math.max(...sizes) < 3000, 'compact: ' + Math.max(...sizes) + ' bytes');
    // Reactions from the crowd are capped per second on the TV.
    let reacts = 0; tv.on('react', () => { reacts++; });
    await Promise.all(fans.slice(0, 60).map((f) => emit(f.s, 'player:react', { e: '😂' })));
    await wait(200); assert(reacts >= 1 && reacts <= 10, 'TV reactions are throttled: ' + reacts);
    // End the game: the audience favourite poll opens; everyone votes.
    await emit(tv, 'host:action', { type: 'lobby' });
    await wait(400);
    assert(promoted && promoted.token === lj2.token, 'the play-next watcher was told to join');
    const back = await emit(late, 'player:join', { code: made.code, token: lj2.token }); assert(back.ok && !back.audience, 'and rejoins as a player');
    // Vote on a game poll: no poll yet → error; a fake end of game opens it.
    const noPoll = await emit(fans[0].s, 'audience:vote', { option: 'p1' }); assert.equal(noPoll.ok, false);
    const leave = await emit(fans[1].s, 'player:leave', {}); assert(leave.ok);
    await wait(400); assert.equal(tvAud.audience, 150, 'the promoted watcher and the one who left are gone from the count');
    // Profiles: create, link, title.
    const prof = await emit(host, 'profile:create', {}); assert(prof.ok && prof.token);
    const got = await emit(host, 'profile:get', { auth: { id: prof.id, token: prof.token } }); assert(got.ok && got.profile.stats);
    const bad = await emit(host, 'profile:get', { auth: { id: prof.id, token: '0'.repeat(64) } }); assert.equal(bad.ok, false);
    const cl = await emit(host, 'profile:claim', { auth: { id: prof.id, token: prof.token }, name: 'HostyMc', pin: '2468' }); assert(cl.ok);
    const other = await connect(); socks.push(other);
    const li = await emit(other, 'profile:login', { name: 'HostyMc', pin: '2468' }); assert(li.ok && li.id === prof.id);
    await wait(100); assert(tvState.players.find((p) => p.name === 'Host'), 'still the same player');
  } finally { for (const s of socks) try { s.close(); } catch { /* */ } server.kill(); }
}

(async () => {
  for (const [name, fn] of tests) { fn(); passed++; console.log(`  ✓ ${name}`); }
  await socketTests(); passed++; console.log('  ✓ Sockets: busy rooms ask, 150 watchers get a compact shared state, play-next watchers rejoin as players, profiles link');
  console.log(`\nAll ${passed} box audience tests passed.`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
