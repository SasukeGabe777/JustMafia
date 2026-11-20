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
  for (const n of [1, 2, 6, 20]) for (const ms of [90000, ten, 3600000]) for (let place = 1; place <= n; place++) { const g = GOLD.goldFor('x', place, n, ms); assert(g >= 1 && g <= 60, `sane amount ${g}`); }
});

// docs/justgold.md "Earning": the numbers the owner signed off on (a common item after 2–4 games).
test('payout table: participation + placement for a 10-minute game of 6, short games and the caps', () => {
  const ten = 10 * 60000, R = GOLD.RATES;
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((pl) => GOLD.goldFor('likely', pl, 6, ten)), [33, 27, 23, 15, 15, 15]);
  assert.deepEqual([1, 2].map((pl) => GOLD.goldFor('likely', pl, 2, ten)), [33, 15], 'two players: no podium line for last place');
  assert.equal(GOLD.goldFor('escape', 3, 4, ten), 27, 'co-op: everyone gets "Team cleared it"');
  assert.equal(GOLD.goldFor('escape', 3, 4, ten, false), 15, 'co-op that failed: just playing');
  assert.equal(GOLD.goldFor('likely', 1, 6, 60 * 60000), Math.round(33 * 1.6), 'long games pay up to ×1.6');
  // Every source is its own line.
  const g = GOLD.gameLines({ game: 'likely', place: 1, of: 6, ms: ten, achievements: [{ icon: '🔮', label: 'Mind reader' }, { icon: '📈', label: 'Comeback win' }, { icon: '🧭', label: 'New game' }, { icon: 'x', label: 'a 4th (capped)' }], night: { games: 5, wins: 2 }, day: { first: true, streak: 4 } });
  assert.deepEqual(g.lines.map((l) => [l.key, l.n]), [['play', 15], ['place', 18], ['ach', 6], ['ach', 6], ['ach', 6], ['roll', 10], ['wins', 10], ['daily', 25], ['streak', 15]]);
  assert.equal(g.total, 111);
  // Short games (90 s – 4 min): half rate, no extras, at most shortCap before the daily bonus.
  const s = GOLD.gameLines({ game: 'likely', place: 1, of: 6, ms: 3 * 60000, achievements: [{ icon: 'x', label: 'y' }], night: { games: 9, wins: 4 }, day: { first: false } });
  assert(s.short && s.total <= R.shortCap && !s.lines.some((l) => ['ach', 'roll', 'wins'].includes(l.key)), JSON.stringify(s.lines));
  assert.equal(s.total, 17);
  // The day streak tops out; the daily bonus is once a day.
  assert.equal(GOLD.dayLines({ first: true, streak: 40 }).find((l) => l.key === 'streak').n, R.dayStreakMax);
  assert.deepEqual(GOLD.dayLines({ first: false, streak: 5 }), []);
  // Tiers by amount.
  assert.deepEqual([5, 20, 45, 80, 200].map((n) => GOLD.tierOf(n)), ['wood', 'silver', 'gold', 'epic', 'epic']);
  assert.equal(GOLD.tierOf(5, true), 'legendary');
  // An evening: 6 ten-minute games in mid-table + the party finale buys a rare (~150–300 JG) item.
  const night = GOLD.dayLines({ first: true, streak: 1 })[0].n + [3, 4, 3, 5, 2, 4].reduce((t, pl, i) => t + GOLD.gameLines({ game: 'likely', place: pl, of: 6, ms: ten, night: { games: i + 1 } }).total, 0) + GOLD.partyLines({ place: 3, of: 6, games: 6, total: 6, stayed: true }).total;
  assert(night >= 250 && night <= 400, 'an evening: ' + night);
  // Three games (one a win) and the daily bonus buy a common (80–150 JG) item.
  const three = 25 + [4, 1, 3].reduce((t, pl, i) => t + GOLD.gameLines({ game: 'likely', place: pl, of: 6, ms: ten, night: { games: i + 1 } }).total, 0);
  assert(three >= 80 && three <= 150, 'three games: ' + three);
});

test('day state: the first game of the day pays the daily bonus, days in a row grow the streak, a gap resets it', () => {
  const w = {}, day = (s) => Date.parse(s + 'T15:00:00Z');
  let d = GOLD.dayInfo(w, day('2026-03-01')); assert(d.first); assert.equal(d.streak, 1); GOLD.markDay(w, d);
  d = GOLD.dayInfo(w, day('2026-03-01')); assert(!d.first, 'once a day');
  d = GOLD.dayInfo(w, day('2026-03-02')); assert(d.first); assert.equal(d.streak, 2); GOLD.markDay(w, d);
  d = GOLD.dayInfo(w, day('2026-03-03')); assert.equal(d.streak, 3); GOLD.markDay(w, d);
  d = GOLD.dayInfo(w, day('2026-03-05')); assert(d.first); assert.equal(d.streak, 1, 'a day missed: back to 1');
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
    // (the game's JustGold; finished challenges and level ups may add their own ledger lines: box/progress.js)
    const got = wallets.coins(p.wallet) - before[i];
    assert(got > 0, 'paid'); assert(got >= p.jg.n, 'the phone is told how much');
    const led = wallets.data.profiles[p.wallet].ledger.find((l) => /Most Likely/.test(l.reason) && !/challenge/i.test(l.reason)); assert.equal(led.delta, p.jg.n);
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

test('Party Mode finale: the legendary chest pays once, by place and real games played, with a bonus for staying all night', () => {
  const { room, wallets, ps } = roomWithAccounts(4, 0);
  // 5 real (paid) games; P3 joined late and played only 2.
  room.partyMode = { defs: [], index: 0, phase: 'done', at: 0, real: 5, paid: { [ps[0].id]: 5, [ps[1].id]: 5, [ps[2].id]: 4, [ps[3].id]: 2 } };
  room.party = new Map(ps.map((p, i) => [p.id, { pts: 40 - i * 10, wins: 0, games: 1 }]));
  room.partyFinished(); room.partyFinished();
  const got = ps.map((p) => wallets.data.profiles[p.wallet].ledger.filter((l) => /Party Mode finale/.test(l.reason)).reduce((n, l) => n + l.delta, 0)); // (challenges may pay too)
  const P = GOLD.PARTY;
  assert.deepEqual(got, [P.stayed + 5 * P.perGame + P.places[0], P.stayed + 5 * P.perGame + P.places[1], P.stayed + 4 * P.perGame + P.places[2], 2 * P.perGame], 'missing one game of 5 still counts as the whole night');
  assert.deepEqual(got, [155, 130, 102, 16]);
  // The TV's chest row and each phone's own chest: legendary, with the lines.
  const c = room.tvState().chest; assert(c && c.kind === 'party' && c.rows.length === 4 && c.rows.every((r) => r.tier === 'legendary'));
  const mine = room.playerState(ps[0]).chest; assert(mine && mine.kind === 'party' && mine.lines.some((l) => l.key === 'stayed') && mine.n >= got[0]);
  assert.equal(mine.after, wallets.coins(ps[0].wallet));
  // No real games (practice / too short / solo): no party gold.
  const z = roomWithAccounts(2, 0); z.room.partyMode = { defs: [], index: 0, phase: 'done', at: 0 };
  z.room.party = new Map(z.ps.map((p, i) => [p.id, { pts: 10 - i, wins: 0, games: 1 }])); z.room.partyFinished();
  assert.equal(z.wallets.data.profiles[z.ps[0].wallet].ledger.filter((l) => /Party Mode finale/.test(l.reason)).length, 0);
});

test('a played Party Mode counts real games for the finale; every game opens a chest on the TV and the phones; the host can skip it', () => {
  const { clock, room, wallets, ps } = roomWithAccounts(3, 1);
  assert(room.setParty([GAMES.likely, GAMES.likely], 60).ok);
  assert(room.start().ok); runOut(room, clock); room.flush();
  const c = room.tvState().chest; assert(c && c.kind === 'game' && c.rows.length === 3, 'one chest per human');
  assert(c.startsIn > 0 && c.left > c.startsIn, 'opens after the end screen has had a moment');
  assert(c.rows.every((r) => r.n > 0 && ['wood', 'silver', 'gold', 'epic'].includes(r.tier)));
  const pc = room.playerState(ps[0]).chest; assert(pc && pc.lines.length >= 2 && pc.lines[0].key === 'play' && pc.after === wallets.coins(ps[0].wallet));
  assert(pc.lines.some((l) => l.key === 'daily'), 'the first game of the day');
  assert.equal(pc.before + pc.n, pc.after, 'the counter rolls from before to after');
  assert(!room.playerState(ps[0]).chest.guest);
  assert.equal(room.vipAction(ps[1], 'chestSkip').ok, false, 'only the host skips');
  assert(room.vipAction(ps[0], 'chestSkip').ok); assert(room.tvState().chest.skipped);
  assert.equal(room.partyMode.real, 1); assert.equal(room.partyMode.paid[ps[0].id], 1);
  // Nothing is paid twice, the daily bonus only once.
  const p2 = room.playerState(ps[0]);
  assert(room.partyNext().ok); assert.equal(room.tvState().chest, null, 'the next game closes the chest');
  runOut(room, clock); room.flush();
  assert(!room.playerState(ps[0]).chest.lines.some((l) => l.key === 'daily'), 'daily bonus once a day');
  assert(p2.me.gold < room.playerState(ps[0]).me.gold, 'the balance on the phone goes up');
  assert.equal(room.partyMode.real, 2);
});

test('a guest without a wallet sees the chest ("save your stuff") and gets the gold when the seat gets a wallet, once', () => {
  const { clock, room, wallets, ps } = roomWithAccounts(3, 0);
  const g = ps[2]; g.wallet = null;
  assert(room.start().ok); runOut(room, clock);
  const st = room.playerState(g); assert(st.chest && st.chest.guest && st.chest.n > 0); assert(st.me.pending === st.chest.n); assert.equal(st.me.gold, null);
  const tvRow = room.tvState().chest.rows.find((r) => r.id === g.id); assert(tvRow && tvRow.guest);
  // Saves: the account gets a wallet (box/index.js dressUp → claimPending).
  const w = wallets.create(); g.wallet = w.id;
  const got = room.claimPending(g); assert.equal(got, st.chest.n); assert.equal(wallets.coins(w.id), got);
  assert.equal(room.claimPending(g), 0, 'once');
  assert(!room.playerState(g).chest.guest); assert.equal(room.playerState(g).jgClaim.n, got);
});

test('kicked players get no chest; a short game pays half', () => {
  const { clock, room, wallets, ps } = roomWithAccounts(3, 0);
  assert(room.start().ok); room.kick(ps[2].id); runOut(room, clock);
  assert(!room.tvState().chest.rows.some((r) => r.id === ps[2].id)); assert.equal(wallets.coins(ps[2].wallet), 0, 'kicked: nothing');
  const q = roomWithAccounts(2, 1); assert(q.room.start().ok);
  while (q.room.game.phase !== 'over' && q.clock.step()); q.room.gameStartAt = q.room.now() - 3 * 60000; q.room.scoreParty(); // (the game "ran" 3 minutes)
  const l = q.room.playerState(q.ps[0]).chest.lines; assert(/short/.test(l[0].label));
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
    const item = st.catalog.find((i) => i.section === 'character' && !i.owned && !i.lock && !i.pct && i.cost <= 500); assert(item, 'something to buy'); // (not today's discounted deal)
    let r = await emit(ph, 'shop:buy', { auth, itemId: item.id }); assert(r.ok, r.error); assert.equal(r.state.gold, 500 - item.cost);
    r = await emit(ph, 'shop:equip', { auth, itemId: item.id, on: true }); assert(r.ok, r.error); assert.equal(r.state.look[item.field], item.value);
    r = await emit(ph, 'shop:look', { auth, look: { skin: r.state.look.skin, hairColor: '#ff0000ff' } }); assert(r.ok);
    for (const bad of [{ auth, itemId: 'nope' }, { auth, itemId: 42 }, { auth: { id: acc.id, token: 'x' }, itemId: item.id }]) assert.equal((await emit(ph, 'shop:buy', bad)).ok, false);
    const pass = st.catalog.find((i) => i.lock && /Season pass/.test(i.lock)); if (pass) assert.equal((await emit(ph, 'shop:buy', { auth, itemId: pass.id })).ok, false, 'pass items stay in JustMafia');
    // Another phone signs in: the same wallet.
    // "Save your stuff": not saved yet, then a name + password.
    let as = await emit(ph, 'account:status', { auth }); assert(as.ok && as.account && !as.saved); assert.equal(as.gold, 500 - item.cost);
    assert.equal((await emit(ph, 'profile:logout', { auth })).ok, false, 'no signing out of an unsaved account (it would be lost)');
    assert.equal((await emit(ph, 'profile:claim', { auth, name: 'AnaG', password: 'abc' })).ok, false, 'too short');
    const cl = await emit(ph, 'profile:claim', { auth, name: 'AnaG', password: 'Gold & Glory 2!' }); assert(cl.ok, cl.error);
    as = await emit(ph, 'account:status', { auth }); assert(as.saved); assert.equal(as.name, 'AnaG');
    const ph2 = await connect(); socks.push(ph2);
    assert.equal((await emit(ph2, 'profile:login', { name: 'AnaG', password: 'gold & glory 2!' })).ok, false, 'wrong password');
    const lg = await emit(ph2, 'profile:login', { name: 'anag', password: 'Gold & Glory 2!' }); assert(lg.ok, lg.error);
    const auth2 = { id: lg.id, token: lg.token };
    // The second phone brings its own (empty) JustMafia wallet: the account's wallet wins.
    const m2 = await connect('/'); socks.push(m2);
    const own2 = await emit(m2, 'profile:create', {}); assert(own2.ok);
    const link2 = await emit(ph2, 'account:wallet', { auth: auth2, mafia: { id: own2.id, token: own2.token } }); assert(link2.ok && link2.wallet.id === mp.id && link2.wallet.token !== mp.token);
    const res2 = await emit(m2, 'profile:resume', link2.wallet); assert(res2.ok, 'the new phone opens the same wallet in JustMafia');
    assert.equal(res2.profile.coins, 500 - item.cost, 'JustMafia shows the same gold on the new phone');
    const st2 = await emit(ph2, 'shop:state', { auth: auth2 }); assert(st2.ok); assert.equal(st2.gold, 500 - item.cost, 'the shop shows the same gold on the new phone');
    assert(st2.owned.includes(item.id), 'and the same items');
    // Change the password (needs the old one); then sign out on the second phone.
    assert.equal((await emit(ph2, 'profile:password', { auth: auth2, old: 'nope', password: 'brand new pw' })).ok, false);
    assert((await emit(ph2, 'profile:password', { auth: auth2, old: 'Gold & Glory 2!', password: 'brand new pw' })).ok);
    assert.equal((await emit(ph2, 'profile:login', { name: 'AnaG', password: 'Gold & Glory 2!' })).ok, false);
    assert((await emit(ph2, 'profile:logout', { auth: auth2 })).ok);
    assert.equal((await emit(ph2, 'shop:state', { auth: auth2 })).ok, false, 'signed out: this phone’s token stops working');
    assert((await emit(ph, 'shop:state', { auth })).ok, 'the first phone keeps going');
    const lg3 = await emit(ph2, 'profile:login', { name: 'AnaG', password: 'brand new pw' }); assert(lg3.ok && lg3.id === acc.id);
    // A phone without an account still sees its JustMafia gold in the status (for the save prompt).
    const m3 = await connect('/'); socks.push(m3);
    const mw3 = await emit(m3, 'profile:create', {}); assert((await emit(m3, 'dev:grant', { amount: 42 })).ok);
    const as3 = await emit(ph2, 'account:status', { mafia: { id: mw3.id, token: mw3.token } }); assert(as3.ok && !as3.account && !as3.saved); assert.equal(as3.gold, 42);
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
