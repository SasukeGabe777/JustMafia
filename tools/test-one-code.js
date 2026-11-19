'use strict';
// One code for the whole night (one-code.js): /j/CODE and /join?code= send a phone to wherever
// the group is now (a box game, a big game's own page, JustMafia); the JustMafia TV shows the box
// room's code; codes typed on either join page reach any game; the title screen's host API
// switches a live room (box games, the big games, JustMafia, Party Mode) instead of making a new
// one, and a JustMafia town that moves to the box keeps its code. Real server, real sockets.
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { io } = require('socket.io-client');
const { createBridge } = require('../mafia-bridge');

const PORT = 3971, URL = 'http://localhost:' + PORT;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const emit = (s, ev, msg) => new Promise((res) => s.emit(ev, msg, (r) => res(r)));
const connect = (ns = '/box') => new Promise((res, rej) => { const s = io(URL + ns, { transports: ['websocket'], forceNew: true, reconnection: false }); s.once('connect', () => res(s)); s.once('connect_error', rej); });
const where = async (p) => { const r = await fetch(URL + p, { redirect: 'manual' }); return { status: r.status, to: r.headers.get('location') }; };
const post = (p, body) => fetch(URL + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
// The latest 'me' / 'tv' a socket got, and a wait for one that matches.
function track(s, ev) {
  const t = { last: null, waiters: [] };
  s.on(ev, (v) => { t.last = v; t.waiters = t.waiters.filter((w) => !(w.fn(v) && (w.res(v), true))); });
  t.until = (fn, ms = 3000) => (t.last && fn(t.last) ? Promise.resolve(t.last) : new Promise((res, rej) => { const w = { fn, res }; t.waiters.push(w); setTimeout(() => rej(new Error(`timed out waiting for ${ev}`)), ms).unref(); }));
  return t;
}
const nextEvent = (s, ev, ms = 3000) => new Promise((res, rej) => { s.once(ev, res); setTimeout(() => rej(new Error('no ' + ev)), ms).unref(); });

let passed = 0;
const ok = (name) => { passed++; console.log(`  ✓ ${name}`); };

// Unit: the bridge's recall (the title screen wants the group back from JustMafia).
function unitRecall() {
  const fakeIo = { to: () => ({ emit: () => {} }) };
  const rooms = new Map();
  const b = { code: 'BOXX', hostKey: 'k', away: { game: 'mafia' }, list: () => [], def: { key: 'likely' }, externalBack() { this.away = null; return { ok: true }; }, externalResult() { this.away = null; } };
  const box = { get: (c) => (c === 'BOXX' ? b : null), GAMES: {} };
  let n = 0;
  const bridge = createBridge({ io: fakeIo, rooms, box, createMafiaRoom: () => { const r = { code: 'MAF' + ++n, hostKey: 'mk', phase: 'lobby', sync() {}, list: () => [], hostChannel: () => 'h', playerChannel: () => 'p' }; rooms.set(r.code, r); return r; } });
  const f = bridge.fromBox(b); assert(f.ok);
  rooms.get(f.code).phase = 'night';
  const r1 = bridge.recall(b); assert.equal(r1.ok, false, 'a running Mafia game is not interrupted'); assert.match(r1.error, /running/);
  rooms.get(f.code).phase = 'lobby';
  const r2 = bridge.recall(b); assert(r2.ok); assert.equal(r2.code, 'BOXX'); assert.equal(b.away, null); assert(!bridge.links.has(f.code));
  b.away = { game: 'mafia' }; rooms.clear(); bridge.fromBox(b); rooms.clear();
  assert(bridge.recall(b).ok, 'a town that closed: the box room just comes back'); assert.equal(b.away, null);
  ok('Bridge recall: brings the group back from a Mafia lobby/end screen, never from a running game');
}

async function socketTests() {
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: String(PORT), MT_PROFILE_STORE: 'memory', PUBLIC_URL: '' }, stdio: 'pipe' });
  const socks = [];
  let errOut = ''; server.stderr.on('data', (b) => { errOut += b; });
  try {
    await new Promise((resolve, reject) => { server.stdout.on('data', (b) => { if (String(b).includes('running')) resolve(); }); server.once('exit', () => reject(new Error('server exited: ' + errOut))); setTimeout(() => reject(new Error('server did not start')), 8000).unref(); });

    // ---- a box room: the universal address ----
    const tv = await connect(); socks.push(tv);
    const made = await emit(tv, 'host:create', { game: 'likely' }); assert(made.ok);
    const CODE = made.code, creds = { box: { code: CODE, hostKey: made.hostKey, game: 'likely' } };
    const ana = await connect(); socks.push(ana); const anaMe = track(ana, 'me');
    const bo = await connect(); socks.push(bo); const boMe = track(bo, 'me');
    assert((await emit(ana, 'player:join', { code: CODE, name: 'Ana' })).ok);
    assert((await emit(bo, 'player:join', { code: CODE, name: 'Bo' })).ok);
    await emit(tv, 'host:action', { type: 'addBots', count: 3 });
    assert.deepEqual(await where('/j/' + CODE), { status: 302, to: '/box/play?room=' + CODE });
    assert.deepEqual(await where('/j/' + CODE.toLowerCase()), { status: 302, to: '/box/play?room=' + CODE }, 'lower case works');
    assert.deepEqual(await where('/join?code=' + CODE), { status: 302, to: '/box/play?room=' + CODE });
    assert.deepEqual(await where('/join'), { status: 302, to: '/box/play' }, '/join alone: the join form for any game');
    assert.deepEqual(await where('/j/ZZZZ'), { status: 302, to: '/box/play?room=ZZZZ' }, 'unknown: the form with the code filled in');
    const w0 = await fetch(URL + '/api/where?code=' + CODE).then((r) => r.json());
    assert(w0.ok); assert.equal(w0.kind, 'box'); assert.equal(w0.game, 'likely'); assert.equal(w0.away, null); assert(!('hostKey' in w0));
    ok('/j/CODE and /join?code= open the room\'s phone page');

    // ---- the title screen: the live room, checked with its host key ----
    const live = await post('/api/host/room', creds);
    assert(live.ok); assert.equal(live.code, CODE); assert.equal(live.game, 'likely'); assert.equal(live.players, 2, 'bots do not count'); assert.equal(live.online, 2); assert.equal(live.tv, '/box/tv?game=likely&resume=1');
    assert.equal((await post('/api/host/room', { box: { code: CODE, hostKey: 'nope' } })).ok, false, 'a wrong key is not this TV\'s room');
    assert.equal((await post('/api/host/room', {})).ok, false);
    assert.equal((await post('/api/host/pick', { box: { code: CODE, hostKey: 'nope' }, game: 'president' })).ok, false);
    assert.equal((await post('/api/host/pick', { ...creds, game: 'nope' })).ok, false);
    ok('Host API: a live room only with its host key');

    // A game is running: picking another one on the title screen still switches (same code).
    assert((await emit(tv, 'host:action', { type: 'start' })).ok);
    let pk = await post('/api/host/pick', { ...creds, game: 'president' });
    assert(pk.ok, pk.error); assert.equal(pk.tv, '/box/tv?game=president&resume=1'); assert.deepEqual(pk.box, { code: CODE, hostKey: made.hostKey, game: 'president' });
    await anaMe.until((v) => v.game === 'president' && v.phase === 'lobby'); await boMe.until((v) => v.game === 'president');
    // Picking the game it is already on just goes back to the room.
    pk = await post('/api/host/pick', { ...creds, game: 'president' }); assert(pk.ok); assert.equal(pk.tv, '/box/tv?game=president&resume=1');
    // A big game with its own address: same code, its own TV and phone pages.
    pk = await post('/api/host/pick', { ...creds, game: 'ducks' });
    assert(pk.ok, pk.error); assert.equal(pk.tv, '/ducks?resume=1'); assert.equal(pk.box.code, CODE);
    await anaMe.until((v) => v.game === 'ducks');
    assert.deepEqual(await where('/j/' + CODE), { status: 302, to: '/ducks/play?room=' + CODE });
    pk = await post('/api/host/pick', { ...creds, game: 'kingdoms' }); assert(pk.ok, pk.error); assert.equal(pk.tv, '/kingdoms?resume=1');
    await boMe.until((v) => v.game === 'kingdoms');
    assert.deepEqual(await where('/j/' + CODE), { status: 302, to: '/kingdoms/play?room=' + CODE });
    ok('Title screen picks switch the live room: small games, ducks, kingdoms; phones follow, the code stays');

    // ---- JustMafia from the title screen ----
    pk = await post('/api/host/pick', { ...creds, game: 'mafia' });
    assert(pk.ok, pk.error); assert.equal(pk.tv, '/mafia?resume=1'); assert(pk.mafia && pk.mafia.code && pk.mafia.hostKey); assert.notEqual(pk.mafia.code, CODE);
    const MAF = pk.mafia.code;
    const anaAway = await anaMe.until((v) => !!v.away);
    assert.equal(anaAway.away.url, `/play?room=${MAF}&autojoin=1&name=Ana`, 'the phone follows, joined with its name');
    const w1 = await fetch(URL + '/api/where?code=' + CODE).then((r) => r.json());
    assert.deepEqual(w1.away, { game: 'mafia', title: 'JustMafia', code: MAF });
    const live2 = await post('/api/host/room', creds);
    assert(live2.ok); assert.equal(live2.tv, '/mafia?resume=1'); assert.deepEqual(live2.mafia, pk.mafia); assert.equal(live2.away.game, 'mafia');
    // The Mafia TV shows the box room's code (the one everybody already scanned).
    const mtv = await connect('/'); socks.push(mtv);
    const linkP = nextEvent(mtv, 'host:boxLink');
    assert((await emit(mtv, 'host:resume', pk.mafia)).ok);
    const link = await linkP; assert.equal(link.box, CODE);
    // Ana's phone arrives in JustMafia (what /play?...&autojoin=1 does).
    const anaM = await connect('/'); socks.push(anaM);
    assert((await emit(anaM, 'player:join', { code: MAF, name: 'Ana' })).ok);
    // A newcomer scans the same QR: the box phone page, then on into JustMafia's lobby.
    const cy = await connect(); socks.push(cy); const cyMe = track(cy, 'me');
    const cj = await emit(cy, 'player:join', { code: CODE, name: 'Cy' }); assert(cj.ok, cj.error); assert(!cj.audience);
    const cyAway = await cyMe.until((v) => !!v.away);
    assert.equal(cyAway.away.url, `/play?room=${MAF}&autojoin=1&name=Cy`);
    const cyM = await connect('/'); socks.push(cyM);
    const cyJoin = await emit(cyM, 'player:join', { code: MAF, name: 'Cy' }); assert(cyJoin.ok, cyJoin.error);
    // Typing the box code on JustMafia's join page goes to the box page (and on to the town).
    const mchk = await emit(cyM, 'room:check', { code: CODE }); assert.equal(mchk.box, true); assert.equal(mchk.url, '/kingdoms/play?room=' + CODE, 'the box room waits on its last game');
    // Typing a JustMafia code on the box join page goes to JustMafia's join page.
    const bchk = await emit(cy, 'room:check', { code: MAF }); assert.equal(bchk.ok, false); assert.equal(bchk.url, '/play?room=' + MAF);
    const bj = await emit(await connect().then((s) => (socks.push(s), s)), 'player:join', { code: MAF, name: 'Di' }); assert.equal(bj.ok, false); assert.equal(bj.url, '/play?room=' + MAF);
    assert.deepEqual(await where('/j/' + MAF), { status: 302, to: '/play?room=' + MAF }, 'the town\'s own code still works');
    ok('JustMafia: TV shows the box code, phones follow by name, a late scanner lands in the town, codes work on both join pages');

    // Picking JustMafia again while the group is there: straight back to its TV.
    pk = await post('/api/host/pick', { ...creds, game: 'mafia' }); assert(pk.ok); assert.equal(pk.tv, '/mafia?resume=1'); assert.equal(pk.mafia.code, MAF);
    // Picking a box game while the group is in JustMafia: everyone comes back (no rejoining).
    const gotoP = nextEvent(anaM, 'mt:goto');
    pk = await post('/api/host/pick', { ...creds, game: 'likely' });
    assert(pk.ok, pk.error); assert.equal(pk.tv, '/box/tv?game=likely&resume=1'); assert.equal(pk.box.code, CODE);
    assert.equal((await gotoP).url, `/box/play?room=${CODE}&name=Ana&auto=1`);
    await boMe.until((v) => v.game === 'likely' && !v.away);
    assert.equal((await fetch(URL + '/api/where?code=' + CODE).then((r) => r.json())).away, null);
    ok('Title screen while in JustMafia: JustMafia again resumes it; a box game brings everyone back');

    // ---- Party Mode in the live room: the lineup, JustMafia included, keeps the code ----
    pk = await post('/api/host/pick', { ...creds, game: 'mafia', party: { games: ['mafia', 'president', 'likely'], minutes: 60, flow: 'auto' } });
    assert(pk.ok, pk.error); assert.equal(pk.tv, '/box/tv?game=president&resume=1', 'the party starts in a box game; JustMafia comes later');
    const st = await boMe.until((v) => v.game === 'president' && v.partyMode);
    assert.deepEqual(st.partyMode.games, ['president', 'likely', 'mafia']); assert.equal(st.code, CODE);
    assert.equal((await post('/api/host/pick', { ...creds, party: { games: ['mafia'] } })).ok, false, 'a party needs a box game');
    // A single game picked afterwards ends the lineup (the points stay).
    pk = await post('/api/host/pick', { ...creds, game: 'blanks' }); assert(pk.ok, pk.error);
    const st2 = await boMe.until((v) => v.game === 'blanks'); assert.equal(st2.partyMode, null);
    ok('Party Mode from the title screen starts in the same room');

    // ---- a JustMafia town of its own: moving to the box keeps its code ----
    const town = await connect('/'); socks.push(town);
    const tm = await emit(town, 'host:create', {}); assert(tm.ok);
    const T = tm.code, tcreds = { mafia: { code: T, hostKey: tm.hostKey } };
    const eve = await connect('/'); socks.push(eve);
    assert((await emit(eve, 'player:join', { code: T, name: 'Eve' })).ok);
    assert.deepEqual(await where('/j/' + T), { status: 302, to: '/play?room=' + T });
    const tl = await post('/api/host/room', tcreds); assert(tl.ok); assert.equal(tl.kind, 'mafia'); assert.equal(tl.tv, '/mafia?resume=1'); assert.equal(tl.players, 1);
    const eveGo = nextEvent(eve, 'mt:goto');
    pk = await post('/api/host/pick', { ...tcreds, game: 'spectrum' });
    assert(pk.ok, pk.error); assert.equal(pk.box.code, T, 'the box room keeps the town\'s code'); assert.equal(pk.tv, '/box/tv?game=spectrum&resume=1');
    assert.equal((await eveGo).url, `/box/play?room=${T}&name=Eve&auto=1`);
    assert.deepEqual(await where('/j/' + T), { status: 302, to: '/box/play?room=' + T }, 'the code now opens the box room');
    const tchk = await emit(eve, 'room:check', { code: T }); assert.equal(tchk.box, true);
    // The same happens from JustMafia's own "Play another game" button.
    const town2 = await connect('/'); socks.push(town2);
    const tm2 = await emit(town2, 'host:create', {}); assert(tm2.ok);
    const tb = await emit(town2, 'host:toBox', { game: 'price' }); assert(tb.ok, tb.error); assert.equal(tb.code, tm2.code);
    ok('A JustMafia town that moves to the box keeps its code (title screen and "Play another game")');

    // ---- the TV pages encode the universal address ----
    const tvJs = await fetch(URL + '/box/tv.js').then((r) => r.text());
    assert(tvJs.includes('`${baseUrl}/j/${state.code}`'), 'box TV QR is /j/CODE');
    const hostJs = await fetch(URL + '/host.js').then((r) => r.text());
    assert(hostJs.includes('/j/${joinCode()}'), 'Mafia TV QR is /j/CODE');
    ok('Every QR is /j/CODE');
  } finally { for (const s of socks) try { s.close(); } catch { /* */ } server.kill(); }
}

(async () => {
  unitRecall();
  await socketTests();
  console.log(`\nAll ${passed} one-code tests passed.`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
