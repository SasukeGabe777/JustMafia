'use strict';
// JustGold (docs/justgold.md): one account, one wallet, one character, one shop.
//   node tools/test-justgold.js
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const { GAMES } = require('../box');
const { ProfileStore } = require('../profiles');
const { BoxProfileStore } = require('../box/profiles');
const GOLD = require('../box/gold');
const { io } = require('socket.io-client');

let passed = 0;
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const runOut = (r, clock, max = 600000) => { let i = 0; while (r.game.phase !== 'over' && clock.step()) if (++i > max) throw new Error('never ended'); r.scoreParty(); // (the live server scores on its next sync)
};

test('a wallet works on several phones; tokens from other wallets do not', () => {
  const w = new ProfileStore(null), a = w.create(), b = w.create();
  const second = w.addDevice(a.id);
  assert(w.authenticate({ id: a.id, token: a.token }), 'the first phone still works');
  assert(w.authenticate(second), 'the new phone works');
  assert.equal(w.authenticate({ id: a.id, token: b.token }), null);
  assert(!('verifiers' in w.view(a.id)), 'device verifiers never leave the server');
});

test('body type: a free look field, validated; old looks without it are inferred (long hair or a dress → female)', () => {
  const w = new ProfileStore(null), a = w.create();
  w.select(a.id, { body: 'female', hair: 'short' }); assert.equal(w.lookOf(a.id).body, 'female');
  w.select(a.id, { body: 'robot' }); assert.equal(w.lookOf(a.id).body, 'female', 'junk keeps the saved body');
  const p = w.data.profiles[a.id]; delete p.avatar.body;
  w.select(a.id, { hair: 'long' }); assert.equal(w.lookOf(a.id).body, 'female', 'long hair reads as female');
  delete p.avatar.body; w.select(a.id, { hair: 'short', outfit: 'shirt' }); assert.equal(w.lookOf(a.id).body, 'male');
  w.select(a.id, { body: 'female' }); assert.equal(w.lookOf(a.id).body, 'female');
});

test('JustGold rates: longer games and better places pay more; co-op pays everyone alike; party is the big one', () => {
  const ten = 10 * 60000;
  assert(GOLD.goldFor('likely', 1, 6, ten) > GOLD.goldFor('likely', 3, 6, ten));
  assert(GOLD.goldFor('likely', 3, 6, ten) > GOLD.goldFor('likely', 6, 6, ten));
  assert(GOLD.goldFor('likely', 1, 6, 30 * 60000) > GOLD.goldFor('likely', 1, 6, ten));
  assert.equal(GOLD.goldFor('escape', 1, 4, ten), GOLD.goldFor('escape', 4, 4, ten));
  assert(GOLD.partyGold(1) > GOLD.goldFor('likely', 1, 6, 40 * 60000), 'winning a party beats winning one long game');
  for (const n of [1, 2, 6, 20]) for (const ms of [90000, ten, 3600000]) for (let place = 1; place <= n; place++) { const g = GOLD.goldFor('x', place, n, ms); assert(g >= 1 && g <= 40, `sane amount ${g}`); }
});

function roomWithAccounts(humans = 3, bots = 2, game = 'likely') {
  const clock = new VirtualClock(), wallets = new ProfileStore(null), accounts = new BoxProfileStore(null);
  const room = new BoxRoom('GOLD', GAMES[game], { clock, seed: 2, profiles: accounts, wallets });
  const ps = [];
  for (let i = 0; i < humans; i++) {
    const p = room.join('P' + i).player; p.sockets = 1;
    const acc = accounts.create('P' + i), w = wallets.create(); accounts.setWallet(acc.id, w.id);
    p.profileId = acc.id; p.wallet = w.id; ps.push(p);
  }
  room.addBots(bots);
  return { clock, room, wallets, accounts, ps };
}

test('a finished box game pays JustGold once, through the ledger, and reveals a shelf item', () => {
  const { clock, room, wallets, ps } = roomWithAccounts(3, 2);
  const before = ps.map((p) => wallets.coins(p.wallet)), shelf = ps.map((p) => wallets.data.profiles[p.wallet].stock.length);
  assert(room.start().ok); runOut(room, clock);
  ps.forEach((p, i) => {
    const got = wallets.coins(p.wallet) - before[i];
    assert(got > 0, 'paid'); assert.equal(p.jg.n, got, 'the phone is told how much');
    const led = wallets.data.profiles[p.wallet].ledger[0]; assert.equal(led.delta, got); assert(/Most Likely/.test(led.reason));
    assert(wallets.data.profiles[p.wallet].stock.length > shelf[i], 'something new on the shelf');
  });
  const again = ps.map((p) => wallets.coins(p.wallet));
  room.recordProfiles('likely', room.game.results(), []); // the same result recorded twice
  ps.forEach((p, i) => assert.equal(wallets.coins(p.wallet), again[i], 'never paid twice'));
});

test('no JustGold for a lone player with bots, or a game shorter than 90 seconds', () => {
  const solo = roomWithAccounts(1, 4);
  assert(solo.room.start().ok); runOut(solo.room, solo.clock);
  assert.equal(solo.wallets.coins(solo.ps[0].wallet), 0); assert(/2 or more/.test(solo.ps[0].jg.why));
  const quick = roomWithAccounts(2, 2);
  assert(quick.room.start().ok); quick.room.gameStartAt = quick.room.now();
  quick.room.recordProfiles('likely', quick.ps.map((p) => p.id), []);
  assert.equal(quick.wallets.coins(quick.ps[0].wallet), 0); assert(/too short/.test(quick.ps[0].jg.why));
});

test('Party Mode finale pays everyone once, the winner most', () => {
  const { room, wallets, ps } = roomWithAccounts(3, 0);
  room.partyMode = { defs: [], index: 0, phase: 'done', at: 0 };
  room.party = new Map(ps.map((p, i) => [p.id, { pts: 30 - i * 10, wins: 0, games: 1 }]));
  room.partyFinished(); room.partyFinished();
  const got = ps.map((p) => wallets.coins(p.wallet));
  assert.deepEqual(got, [GOLD.partyGold(1), GOLD.partyGold(2), GOLD.partyGold(3)]);
});

test('players wear their account: look and gear reach the TV and their phone', () => {
  const { room, wallets, ps } = roomWithAccounts(2, 0);
  const w = ps[0].wallet; wallets.data.profiles[w].lookSaved = true; ps[0].look = wallets.lookOf(w); ps[0].gear = { marble: { skin: 'ruby' } };
  const tv = room.tvState().players.find((x) => x.id === ps[0].id);
  assert(tv.look && tv.look.outfit, 'the look is on the TV'); assert.deepEqual(tv.gear, { marble: { skin: 'ruby' } });
  assert.equal(room.tvState().players.find((x) => x.id === ps[1].id).look, null, 'no character yet: the emoji stays');
  assert(room.playerState(ps[0]).me.look);
});

// ---- over real sockets: account → wallet link, the shop ----
const PORT = 3963, URL = `http://127.0.0.1:${PORT}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const emit = (s, ev, msg) => new Promise((res) => s.emit(ev, msg, (r) => res(r)));
const connect = (ns = '/box') => new Promise((res, rej) => { const s = io(URL + ns, { transports: ['websocket'], forceNew: true, reconnection: false }); s.once('connect', () => res(s)); s.once('connect_error', rej); });
async function socketTests() {
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: String(PORT), MT_PROFILE_STORE: 'memory', MT_DEV_GRANTS: '1' }, stdio: 'pipe' });
  const socks = [];
  try {
    await new Promise((resolve, reject) => { server.stdout.on('data', (b) => { if (String(b).includes('running')) resolve(); }); setTimeout(() => reject(new Error('server did not start')), 8000).unref(); });
    // A phone that already played JustMafia: its JustMafia profile (gold!) becomes the wallet.
    const mafia = await connect('/'); socks.push(mafia);
    const mp = await emit(mafia, 'profile:create', {}); assert(mp.ok);
    assert((await emit(mafia, 'dev:grant', { amount: 500 })).ok);
    const ph = await connect(); socks.push(ph);
    const acc = await emit(ph, 'profile:create', { name: 'Ana' }); assert(acc.ok);
    const auth = { id: acc.id, token: acc.token };
    assert.equal((await emit(ph, 'shop:state', { auth })).ok, false, 'no wallet before linking');
    const link = await emit(ph, 'account:wallet', { auth, mafia: { id: mp.id, token: mp.token } }); assert(link.ok && link.linked && link.wallet.id === mp.id);
    let st = await emit(ph, 'shop:state', { auth }); assert(st.ok); assert.equal(st.gold, 500, 'JustMafia gold carried over');
    assert(st.catalog.some((i) => i.section === 'character') && st.catalog.some((i) => i.section === 'mafia'));
    assert(!st.catalog.some((i) => i.field === 'deathAnim' && i.section !== 'mafia'));
    // Buy something on the shelf, equip it, set colours.
    const item = st.catalog.find((i) => i.section === 'character' && !i.owned && !i.lock && i.cost <= 500); assert(item, 'something to buy');
    let r = await emit(ph, 'shop:buy', { auth, itemId: item.id }); assert(r.ok, r.error); assert.equal(r.state.gold, 500 - item.cost);
    r = await emit(ph, 'shop:equip', { auth, itemId: item.id, on: true }); assert(r.ok, r.error); assert.equal(r.state.look[item.field], item.value);
    r = await emit(ph, 'shop:look', { auth, look: { skin: r.state.look.skin, hairColor: '#ff0000ff' } }); assert(r.ok);
    for (const bad of [{ auth, itemId: 'nope' }, { auth, itemId: 42 }, { auth: { id: acc.id, token: 'x' }, itemId: item.id }]) assert.equal((await emit(ph, 'shop:buy', bad)).ok, false);
    const pass = st.catalog.find((i) => i.lock && /Season pass/.test(i.lock)); if (pass) assert.equal((await emit(ph, 'shop:buy', { auth, itemId: pass.id })).ok, false, 'pass items stay in JustMafia');
    // Another phone signs in: the same wallet.
    const cl = await emit(ph, 'profile:claim', { auth, name: 'AnaG', pin: '1357' }); assert(cl.ok);
    const ph2 = await connect(); socks.push(ph2);
    const lg = await emit(ph2, 'profile:login', { name: 'AnaG', pin: '1357' }); assert(lg.ok);
    const link2 = await emit(ph2, 'account:wallet', { auth: { id: lg.id, token: lg.token } }); assert(link2.ok && link2.wallet.id === mp.id && link2.wallet.token !== mp.token);
    const m2 = await connect('/'); socks.push(m2);
    const res2 = await emit(m2, 'profile:resume', link2.wallet); assert(res2.ok, 'the new phone opens the same wallet in JustMafia');
    // In a box room: the look is worn; no shopping mid-game.
    const tv = await connect(); socks.push(tv);
    const made = await emit(tv, 'host:create', { game: 'likely' }); assert(made.ok);
    let tvState = null; tv.on('tv', (s) => { tvState = s; });
    const j = await emit(ph, 'player:join', { code: made.code, name: 'Ana', profile: auth }); assert(j.ok);
    await emit(tv, 'host:action', { type: 'addBots', count: 4 }); await wait(150);
    assert(tvState.players.find((x) => x.name === 'Ana').look, 'Ana wears her character on the TV');
    await emit(tv, 'host:action', { type: 'start' }); await wait(100);
    st = await emit(ph, 'shop:state', { auth }); assert.equal(st.busy, true);
    const shut = await emit(ph, 'shop:equip', { auth, itemId: item.id, on: false }); assert.equal(shut.ok, false); assert(shut.busy);
  } finally { for (const s of socks) try { s.close(); } catch { /* gone */ } server.kill(); }
}

(async () => {
  for (const [n, fn] of tests) { await fn(); passed++; console.log('  ✓ ' + n); }
  await socketTests(); passed++; console.log('  ✓ over sockets: JustMafia gold carries over, buy / equip / look, a second phone, the look on the TV, no shopping mid-game');
  console.log(`\nAll ${passed} JustGold tests passed.`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
