'use strict';
// JustBid: content, bid validation, the countdown, sealed second-price, inspection privacy,
// hidden contents, profit math, set bonuses, loans, leavers, late joiners and full games
// with 1, 5 and 100 players on a virtual clock. Run: node tools/test-box-bid.js
const assert = require('node:assert/strict');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/bid');
const { ITEMS, THEMES, SETS, PACKS } = require('../box/games/bid-items');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };
function setup(bots = 0, settings = {}, seed = 7) {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed });
  room.addBots(bots); Object.assign(room.settings, settings);
  return { room, clock };
}
const human = (room, name) => { const p = room.join(name).player; p.sockets = 1; return p; };
const stepUntil = (room, clock, pred, limit = 200000) => { let i = 0; while (!pred()) { if (!clock.step()) throw new Error('clock ran dry in ' + room.game.phase); if (++i > limit) throw new Error('stuck in ' + room.game.phase); } };
const runOut = (room, clock) => stepUntil(room, clock, () => room.game.phase === 'over', 3000000);
// Start a game with only humans and jump straight to the live auction of locker 1.
function auction(names = ['Ann', 'Bo'], settings = {}) {
  const { room, clock } = setup(0, settings);
  const ps = names.map((n) => human(room, n)); room.start();
  room.game.next(); assert.equal(room.game.phase, 'auction');
  return { room, clock, g: room.game, ps };
}
// Force the current locker to be a given kind (re-rolls locker `round`).
function forceLocker(g, kind, theme = 'attic') {
  g.plan = g.plan.map(() => ({ kind, theme })); g.round = 0; g.newLocker();
}

test('Content: ~180 original items, 22 themes, sets that can be completed', () => {
  assert(ITEMS.length >= 180, 'only ' + ITEMS.length + ' items');
  assert.equal(THEMES.length, 22);
  assert.equal(new Set(ITEMS.map((i) => i.name)).size, ITEMS.length, 'duplicate item names');
  for (const it of ITEMS) {
    assert(it.emoji && it.name && it.clue.icon && it.clue.text && it.lo > 0 && it.hi >= it.lo, it.name);
    assert(!it.clue.text.toLowerCase().includes(it.name.toLowerCase()), 'clue gives the name away: ' + it.name);
    if (it.set) assert(SETS[it.set], 'unknown set ' + it.set);
  }
  for (const t of THEMES) if (!t.special) assert(ITEMS.filter((i) => i.themes.includes(t.key)).length >= 10, t.key);
  for (const k of Object.keys(SETS)) assert(ITEMS.filter((i) => i.set === k).length >= 3, 'set too small: ' + k);
  assert(ITEMS.filter((i) => i.jackpot).length >= 8, 'jackpots');
});

test('Bid validation: closed phases, too low, over cash, bad input, already high, rate limit', () => {
  const { room, clock } = setup(0);
  const a = human(room, 'Ann'), b = human(room, 'Bo'); room.start();
  const g = room.game;
  assert.equal(g.phase, 'preview');
  assert.equal(room.act(a, { op: 'bid', add: 10 }).ok, false, 'bid during preview');
  stepUntil(room, clock, () => g.phase === 'auction');
  const open = g.locker.opening;
  assert.equal(room.act(a, { op: 'bid', amount: open - 10 }).ok, false, 'under the opening bid');
  for (const bad of [NaN, Infinity, -50, 'abc', '', null, {}, [], true, 12.5, '12.5', 1e12])
    assert.equal(room.act(a, { op: 'bid', amount: bad }).ok, false, 'accepted ' + String(bad));
  a.sockets = 1; // the rate limit counts attempts; move the clock on before real bids
  clock.t += 1500;
  assert.equal(room.act(a, { op: 'bid', add: 7 }).ok, false, 'not a bid button');
  assert.equal(room.act(a, { op: 'bid', amount: 999999 }).ok, false, 'more than cash');
  clock.t += 1500;
  let r = room.act(a, { op: 'bid', add: 10 }); assert(r.ok, r.error); assert.equal(g.high.amount, open);
  assert.equal(room.act(a, { op: 'bid', add: 10 }).ok, false, 'outbid yourself');
  assert.equal(room.act(b, { op: 'bid', amount: open + 5 }).ok, false, 'below the minimum increment');
  assert.equal(room.act(b, { op: 'bid', amount: open }).ok, false, 'a tie loses to the first bid');
  r = room.act(b, { op: 'bid', amount: String(open + 10) }); assert(r.ok, 'numeric strings are fine');
  r = room.act(a, { op: 'bid', add: 25 }); assert(r.ok); assert.equal(g.high.amount, open + 35);
  // A fresh second: Ann gets three bids in; her 4th attempt is rate limited.
  clock.t += 1100;
  assert(room.act(b, { op: 'bid', add: 10 }).ok);
  assert(room.act(a, { op: 'bid', add: 10 }).ok);
  assert(room.act(b, { op: 'bid', add: 10 }).ok);
  assert(room.act(a, { op: 'bid', add: 10 }).ok);
  assert(room.act(b, { op: 'bid', add: 10 }).ok);
  assert(room.act(a, { op: 'bid', add: 10 }).ok);
  r = room.act(a, { op: 'bid', add: 10 }); assert.equal(r.ok, false); assert.match(r.error, /3 bids a second/);
  clock.t += 1001;
  assert(room.act(b, { op: 'bid', add: 10 }).ok);
  assert(room.act(a, { op: 'bid', add: 10 }).ok, 'allowed again a second later');
  assert.equal(room.act(a, { op: 'nope' }).ok, false);
});

test('Every bid restarts the countdown; SOLD to the highest bidder', () => {
  const { room, clock, g, ps: [a, b] } = auction(['Ann', 'Bo'], { countdown: 7 });
  assert(room.act(a, { op: 'bid', add: 10 }).ok);
  assert.equal(g.endsIn(), 7000); assert.equal(g.stage, 0);
  stepUntil(room, clock, () => g.stage === 2);
  assert(g.endsIn() < 7000 / 3 + 1);
  assert(room.act(b, { op: 'bid', add: 100 }).ok);
  assert.equal(g.stage, 0, 'back to "do I hear"'); assert.equal(g.endsIn(), 7000, 'countdown restarted');
  const price = g.high.amount, cash = g.st.get(b.id).cash;
  stepUntil(room, clock, () => g.phase === 'sold');
  assert.equal(g.sale.id, b.id); assert.equal(g.sale.price, price);
  assert.equal(g.st.get(b.id).cash, cash - price);
  assert.equal(g.st.get(a.id).cash, 2000, 'the loser pays nothing');
  assert.equal(room.tvState().state.sale.name, 'Bo');
});

test('No bids at all: no sale, contents still revealed, nobody pays', () => {
  const { room, clock, g, ps: [a] } = auction(['Ann']);
  stepUntil(room, clock, () => g.phase === 'sold');
  assert.equal(g.sale, null);
  stepUntil(room, clock, () => g.revealDone);
  assert.equal(g.result.profit, null); assert.equal(g.st.get(a.id).cash, 2000); assert.equal(g.st.get(a.id).items.length, 0);
});

test('Sealed bid: highest wins and pays second-highest + $10; bids stay secret', () => {
  const sp = def.sealedPrice;
  assert.deepEqual(sp([{ id: 'a', amount: 500 }, { id: 'b', amount: 300 }], 100), { id: 'a', price: 310 });
  assert.deepEqual(sp([{ id: 'a', amount: 305 }, { id: 'b', amount: 300 }], 100), { id: 'a', price: 305 }, 'never more than they bid');
  assert.deepEqual(sp([{ id: 'a', amount: 400 }], 120), { id: 'a', price: 120 }, 'alone: pays the opening');
  assert.equal(sp([], 100), null);
  const { room, clock } = setup(0);
  const a = human(room, 'Ann'), b = human(room, 'Bo'), c = human(room, 'Cy'); room.start();
  const g = room.game; forceLocker(g, 'sealed');
  assert.equal(room.act(a, { op: 'sealed', amount: 500 }).ok, false, 'not open yet');
  stepUntil(room, clock, () => g.phase === 'sealed');
  const open = g.locker.opening;
  assert.equal(room.act(a, { op: 'bid', add: 10 }).ok, false, 'no live bids in a sealed locker');
  assert.equal(room.act(a, { op: 'sealed', amount: open - 10 }).ok, false, 'under the minimum');
  assert.equal(room.act(a, { op: 'sealed', amount: 2001 }).ok, false, 'over cash');
  assert(room.act(a, { op: 'sealed', amount: open + 437 }).ok);
  assert.equal(room.act(a, { op: 'sealed', amount: open + 500 }).ok, false, 'one envelope each');
  assert(room.act(b, { op: 'sealed', amount: open + 221 }).ok);
  const secret = (o) => JSON.stringify(o).includes(String(open + 437)) || JSON.stringify(o).includes(String(open + 221));
  assert(!secret(room.tvState()), 'TV leaked a sealed bid');
  assert(!JSON.stringify(room.playerState(c)).includes(String(open + 437)), 'phone leaked a sealed bid');
  assert.equal(room.playerState(a).state.mySealed, open + 437);
  assert.equal(room.tvState().state.sealedIn, 2);
  assert(room.act(c, { op: 'sealed', amount: open + 221 }).ok);
  stepUntil(room, clock, () => g.phase === 'sold'); // all in: closes early
  assert.equal(g.sale.id, a.id); assert.equal(g.sale.price, open + 231); assert(g.sale.sealed);
  assert.equal(g.st.get(a.id).cash, 2000 - (open + 231));
});

test('Inspection: costs 5% (min $25), once per locker, and only you see the result', () => {
  const { room, clock } = setup(0);
  const a = human(room, 'Ann'), b = human(room, 'Bo'); room.start();
  const g = room.game;
  const r = room.act(a, { op: 'inspect' }); assert(r.ok, r.error);
  assert.equal(r.result.fee, 100); assert.equal(g.st.get(a.id).cash, 1900);
  assert.equal(room.act(a, { op: 'inspect' }).ok, false, 'twice');
  const mine = room.playerState(a).state.inspect.result;
  assert.deepEqual(mine, r.result);
  assert.equal(room.playerState(b).state.inspect.result, null, 'Bo sees nothing');
  const res = JSON.stringify(r.result);
  assert(!JSON.stringify(room.tvState()).includes(res) && !JSON.stringify(room.playerState(b)).includes(res), 'result leaked');
  assert(!/"type":"(rarity|band)"/.test(JSON.stringify(room.tvState())), 'TV got an inspection result');
  assert.deepEqual(room.tvState().state.inspectors, ['Ann'], 'the TV may say WHO peeked');
  g.st.get(b.id).cash = 100;
  assert(room.act(b, { op: 'inspect' }).ok); assert.equal(g.st.get(b.id).cash, 75, 'minimum fee $25');
  // You can't spend money promised to your high bid.
  stepUntil(room, clock, () => g.phase === 'reveal'); g.next(); g.next(); // next locker
  assert.equal(g.phase, 'preview'); g.next();
  g.st.get(a.id).cash = g.locker.opening + 10;
  assert(room.act(a, { op: 'bid', amount: g.locker.opening + 10 }).ok);
  assert.equal(room.act(a, { op: 'inspect' }).ok, false, 'flashlight would eat the high bid');
});

test('Locker contents stay hidden until each item is revealed', () => {
  const { room, clock } = setup(3);
  const a = human(room, 'Ann'); room.start();
  const g = room.game;
  const names = () => g.locker.items.map((it) => it.name);
  const leaks = (o, list) => { const j = JSON.stringify(o); return list.filter((n) => j.includes(JSON.stringify(n).slice(1, -1) + '"')); };
  for (let k = 0; k < 3; k++) {
    stepUntil(room, clock, () => g.phase === 'preview');
    const L = names();
    for (const ph of ['preview', 'auction', 'sold']) {
      if (g.phase !== ph) stepUntil(room, clock, () => g.phase === ph || g.phase === 'reveal');
      if (g.phase === 'reveal') break;
      assert.deepEqual(leaks(room.tvState(), L), [], 'TV leaked in ' + g.phase);
      assert.deepEqual(leaks(room.playerState(a), L), [], 'phone leaked in ' + g.phase);
      assert(!/"value":/.test(JSON.stringify(room.tvState().state)), 'TV leaked a value in ' + g.phase);
    }
    stepUntil(room, clock, () => g.phase === 'reveal' && g.revealed === 2);
    const tv = room.tvState().state;
    assert.equal(tv.reveal.items.length, 2); assert.equal(tv.reveal.result, null, 'no total before the end');
    assert.deepEqual(leaks(tv, L.slice(2)).filter((n) => !L.slice(0, 2).includes(n)), [], 'unrevealed item leaked');
    stepUntil(room, clock, () => g.revealDone);
    assert.equal(room.tvState().state.reveal.items.length, g.locker.size);
    const top = Math.max(...g.locker.items.map((it) => it.value));
    assert.equal(g.locker.items[g.locker.size - 1].value, top, 'best item comes out last');
  }
});

test('Profit/loss math and net worth', () => {
  const { room, clock, g, ps: [a] } = auction(['Ann', 'Bo']);
  assert(room.act(a, { op: 'bid', amount: 400 }).ok);
  stepUntil(room, clock, () => g.revealDone);
  const total = g.locker.items.reduce((s, it) => s + it.value, 0), st = g.st.get(a.id);
  assert.equal(g.result.total, total); assert.equal(g.result.price, 400); assert.equal(g.result.profit, total - 400);
  assert.equal(st.items.length, g.locker.size);
  assert.equal(g.net(st), 2000 - 400 + total + st.bonus);
  assert.deepEqual(st.stats.profits, [total - 400]);
  const me = room.playerState(a).state;
  assert.equal(me.net, g.net(st)); assert.equal(me.collection.value, total);
  assert.equal(room.tvState().state.reveal.result.profit, total - 400);
});

test('Set bonuses: 3 items of a set pay once, announced on the TV', () => {
  const { room, g, ps: [a] } = auction(['Ann']);
  const sports = ITEMS.filter((i) => i.set === 'sports').slice(0, 4);
  const st = g.st.get(a.id);
  g.sale = { id: a.id, name: 'Ann', price: 0 };
  g.locker.items = sports.slice(0, 2).map((it) => ({ ...it, value: 50 })); g.news = [];
  g.applyLocker(100); assert.equal(st.bonus, 0, 'two is not a set');
  g.locker.items = [{ ...sports[2], value: 50 }]; g.news = [];
  g.applyLocker(50);
  assert.equal(st.bonus, SETS.sports.bonus); assert.equal(g.news.length, 1); assert.equal(g.news[0].label, SETS.sports.label);
  g.locker.items = [{ ...sports[3], value: 50 }]; g.news = [];
  g.applyLocker(50); assert.equal(st.bonus, SETS.sports.bonus, 'paid once'); assert.equal(st.stats.sets, 1);
  const set = room.playerState(a).state.collection.sets.find((s) => s.key === 'sports');
  assert(set.done && set.n === 3);
  // Scaled with starting cash.
  const r2 = auction(['Zed'], { cash: 5000 }); const st2 = r2.g.st.get(r2.ps[0].id);
  r2.g.sale = { id: r2.ps[0].id, name: 'Zed', price: 0 }; r2.g.locker.items = sports.slice(0, 3).map((it) => ({ ...it, value: 1 })); r2.g.news = [];
  r2.g.applyLocker(3); assert.equal(st2.bonus, SETS.sports.bonus * 2.5);
});

test('Loans: only when low on cash, max 2, repaid with 20% interest', () => {
  const { room, g, ps: [a] } = auction(['Ann']);
  const st = g.st.get(a.id);
  assert.equal(room.act(a, { op: 'loan' }).ok, false, 'not broke yet');
  st.cash = 300;
  assert(room.act(a, { op: 'loan' }).ok); assert.equal(st.cash, 800); assert.equal(st.loans, 1);
  assert(room.act(a, { op: 'loan' }).ok); assert.equal(st.cash, 1300); assert.equal(st.loans, 2);
  st.cash = 100;
  assert.equal(room.act(a, { op: 'loan' }).ok, false, 'max two');
  assert.equal(g.net(st), 100 - 1200);
  const tv = room.tvState().state.standings.find((r) => r.id === a.id);
  assert.equal(tv.loans, 2); assert.equal(tv.debt, 1200);
  const off = auction(['Bo'], { loans: false }); off.g.st.get(off.ps[0].id).cash = 10;
  assert.equal(off.room.act(off.ps[0], { op: 'loan' }).ok, false, 'loans off');
});

test('A leaving high bidder: their bid is withdrawn, the next highest stands', () => {
  const { room, clock, g, ps: [a, b, c] } = auction(['Ann', 'Bo', 'Cy']);
  assert(room.act(a, { op: 'bid', amount: 300 }).ok);
  assert(room.act(c, { op: 'bid', amount: 320 }).ok);
  assert(room.act(b, { op: 'bid', amount: 350 }).ok);
  stepUntil(room, clock, () => g.stage === 2);
  room.remove(b.id);
  assert.equal(g.high.id, c.id); assert.equal(g.high.amount, 320);
  assert.equal(g.stage, 0, 'countdown re-armed');
  room.remove(c.id);
  assert.equal(g.high.id, a.id); assert.equal(g.high.amount, 300);
  stepUntil(room, clock, () => g.phase === 'sold');
  assert.equal(g.sale.id, a.id); assert.equal(g.sale.price, 300);
  // Everyone leaves: nobody wins.
  const r2 = auction(['Dee', 'Eve']);
  assert(r2.room.act(r2.ps[0], { op: 'bid', amount: 200 }).ok);
  r2.room.remove(r2.ps[0].id);
  assert.equal(r2.g.high, null);
  stepUntil(r2.room, r2.clock, () => r2.g.phase === 'sold'); assert.equal(r2.g.sale, null);
});

test('Late joiners wait for the next locker with starting cash', () => {
  const { room, clock, g } = auction(['Ann']);
  const z = human(room, 'Zoe');
  assert.equal(room.act(z, { op: 'bid', add: 10 }).ok, false);
  assert(room.playerState(z).state.waiting);
  stepUntil(room, clock, () => g.phase === 'preview' && g.round === 2);
  assert.equal(room.playerState(z).state.waiting, false);
  assert.equal(g.st.get(z.id).cash, 2000);
  g.next(); assert(room.act(z, { op: 'bid', add: 10 }).ok);
});

test('Special lockers: plan has sealed / mystery / premium and a Grand finale', () => {
  const { room } = setup(0, { rounds: 8 });
  human(room, 'Ann'); room.start();
  const kinds = room.game.plan.map((p) => p.kind);
  assert.equal(kinds[7], 'grand'); assert.equal(kinds[0], 'normal');
  for (const k of ['sealed', 'mystery', 'premium']) assert(kinds.includes(k), k);
  const g = room.game;
  forceLocker(g, 'mystery', 'mystery'); assert.equal(g.locker.clues.length, 0);
  assert.equal(room.tvState().state.locker.clues.length, 0);
  forceLocker(g, 'grand', 'toys'); assert(g.locker.size >= 10, 'grand = double');
  forceLocker(g, 'normal', 'toys'); assert(g.locker.size >= 5 && g.locker.size <= 7); assert.equal(g.locker.clues.length, 3);
  const off = setup(0, { specials: false, rounds: 6 }); human(off.room, 'Bo'); off.room.start();
  assert.deepEqual(off.room.game.plan.map((p) => p.kind), ['normal', 'normal', 'normal', 'normal', 'normal', 'grand']);
});

function full(n, settings, seed) {
  const { room, clock } = setup(n - 1, settings, seed);
  const a = human(room, 'Ann'); room.start();
  let sold = 0, last = null;
  stepUntil(room, clock, () => { if (room.game.sale && room.game.sale !== last) { last = room.game.sale; sold++; } return room.game.phase === 'over'; }, 3000000);
  const tv = room.tvState().state, me = room.playerState(a).state;
  assert.equal(tv.phase, 'over'); assert(tv.final.length === Math.min(20, n));
  assert(me.final && me.my && me.rank >= 1);
  for (const st of room.game.st.values()) assert(st.cash >= 0 && Number.isFinite(st.cash), 'cash went negative');
  return { room, clock, sold, tv };
}
test('Full game: 1 player reaches the end', () => { const { tv } = full(1, { rounds: 6 }); assert.equal(tv.final[0].name, 'Ann'); });
test('Full game: 5 players, lockers sell, awards handed out', () => {
  const { sold, tv, clock } = full(5, { rounds: 8 }, 11);
  assert(sold >= 5, 'only ' + sold + ' sold'); assert(tv.awards.length >= 4);
  assert(clock.now() < 30 * 60000, 'took ' + clock.now());
});
test('Full game: 100 players (99 bots) never stalls', () => {
  const t0 = Date.now();
  const { room, sold, tv } = full(100, { rounds: 6, countdown: 5, cash: 1000 }, 5);
  assert.equal(room.players.size, 100); assert(sold >= 5);
  assert(tv.standings.length === 12);
  assert(Date.now() - t0 < 20000, 'too slow');
});
test('Skip ahead (TV "next") walks every phase to the end', () => {
  const { room } = setup(4, { rounds: 6 });
  human(room, 'Ann'); room.start();
  const seen = new Set();
  for (let i = 0; i < 200 && room.game.phase !== 'over'; i++) { seen.add(room.game.phase); assert(room.hostAction({ type: 'next' }).ok); }
  assert.equal(room.game.phase, 'over');
  for (const ph of ['preview', 'auction', 'sold', 'reveal']) assert(seen.has(ph), ph);
  assert.equal(room.act(room.list()[4], { op: 'bid', add: 10 }).ok, false);
  assert(room.hostAction({ type: 'again' }).ok); assert.equal(room.game.phase, 'preview');
});

test('results() best-first by net worth; the TV names who a sealed bid is waiting on', () => {
  const { room, clock } = setup(3, { rounds: 6 }, 3);
  const a = human(room, 'Ann'), b = human(room, 'Bo'); room.start();
  const g = room.game;
  forceLocker(g, 'sealed'); g.next();
  assert.equal(g.phase, 'sealed');
  assert.deepEqual(room.tvState().state.sealWaiting.sort(), ['Ann', 'Bo']);
  assert(room.act(a, { op: 'sealed', amount: g.locker.opening }).ok);
  assert.deepEqual(room.tvState().state.sealWaiting, ['Bo'], 'bots never hold things up on the TV list');
  void b;
  runOut(room, clock);
  const res = g.results(), nets = res.map((id) => g.net(g.st.get(id)));
  assert.equal(res.length, 5);
  assert.deepEqual(nets, nets.slice().sort((x, y) => y - x));
});

// Run a whole game, noting every locker that rolls in (theme + contents).
function playAll(settings, seed, family) {
  const { room, clock } = setup(3, settings, seed);
  if (family) room.family = true;
  human(room, 'Ann'); room.start();
  const lockers = []; let last = null;
  stepUntil(room, clock, () => { const L = room.game.locker; if (L && L !== last) { last = L; lockers.push(L); } return room.game.phase === 'over'; }, 3000000);
  return { room, lockers };
}

test('Content packs: Holiday, Office, Classics, Travel lockers, 40+ items each, play end to end on their own', () => {
  const field = def.fields.find((x) => x.key === 'pack');
  assert(field && field.options.some((o) => o.value === def.defaults.pack), 'Locker mix setting');
  for (const p of PACKS) {
    assert(field.options.some((o) => o.value === p.key), p.key + ' not in the menu');
    const themes = THEMES.filter((t) => t.pack === p.key).map((t) => t.key);
    assert(themes.length >= 1, p.key);
    const items = ITEMS.filter((i) => i.themes.some((t) => themes.includes(t)));
    assert(items.length >= 40, p.key + ': only ' + items.length);
    for (const r of ['J', 'C', 'G', 'R', 'E', 'L']) assert(items.some((i) => i.r === r), p.key + ' has no ' + r);
    const { room, lockers } = playAll({ rounds: 12, pack: p.key }, 5);
    assert.equal(room.game.phase, 'over');
    assert.equal(lockers.length, 12);
    for (const L of lockers) {
      if (L.theme.key !== 'mystery') assert.equal(L.theme.pack, p.key, p.key + ' rolled a ' + L.theme.key + ' locker');
      for (const it of L.items) assert(it.themes.includes('any') || it.themes.some((t) => themes.includes(t)), p.key + ' locker had ' + it.name);
    }
  }
  // The default mix still uses every original locker theme.
  const { lockers } = playAll({ rounds: 12 }, 3);
  assert(lockers.some((L) => !L.theme.pack || L.theme.key === 'office'));
});

test('Family mode (room.family): no non-family item ever turns up, in any locker kind or pack', () => {
  const bad = new Set(ITEMS.filter((i) => !i.family).map((i) => i.name));
  assert(bad.has('Very old bottle of wine') && bad.has('Jeweled ceremonial dagger'));
  for (const pack of ['all', 'holiday', 'office']) for (const seed of [1, 2]) {
    const { lockers } = playAll({ rounds: 12, pack }, seed, true);
    for (const L of lockers) for (const it of L.items) assert(!bad.has(it.name), pack + ': ' + it.name);
  }
  // Hammer the lockers most likely to hold them: the Vault, Mystery, Movie Props, Kitchen.
  const { room } = setup(0, {}); room.family = true; human(room, 'Ann'); room.start();
  const g = room.game;
  for (let k = 0; k < 60; k++) for (const [kind, theme] of [['premium', 'vault'], ['mystery', 'mystery'], ['grand', 'movie'], ['normal', 'kitchen'], ['normal', 'pirate']]) {
    forceLocker(g, kind, theme);
    for (const it of g.locker.items) assert(!bad.has(it.name), theme + ': ' + it.name);
  }
  // Without Family mode they can still appear.
  const off = setup(0, {}); human(off.room, 'Bo'); off.room.start(); let seen = false;
  for (let k = 0; k < 200 && !seen; k++) { forceLocker(off.room.game, 'premium', 'vault'); seen = off.room.game.locker.items.some((it) => bad.has(it.name)); }
  assert(seen, 'non-family items never appeared with Family mode off');
});

console.log(`\nJustBid: ${passed} tests passed`);
