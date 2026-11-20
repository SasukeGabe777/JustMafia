'use strict';
// Shop seasons, daily deals and theme sets (public/shared/shop-season.js, docs/justgold.md):
// limited-time event items, the rotating deals shelf, theme-set bundles and the set bonus.
//   node tools/test-shop-season.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawn } = require('node:child_process');
const C = require('../public/shared/cosmetics');
const O = require('../public/shared/options');
const SEA = require('../public/shared/seasons');
const SS = require('../public/shared/shop-season');
const G = require('../public/shared/gear');
const GOLD = require('../box/gold');
const { ProfileStore } = require('../profiles');
const { io } = require('socket.io-client');

let passed = 0;
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const at = (d, h = 12) => Date.parse(d + 'T00:00:00Z') + h * 3600000;
const item = (id) => C.CATALOG.find((i) => i.id === id);
const store = (gold = 5000) => { const s = new ProfileStore(null), a = s.create(); s.grant(a.id, gold); return { s, id: a.id, p: s.data.profiles[a.id] }; };

test('the calendar: a new event every half month, all year, any year, with stable ids and the real holidays', () => {
  assert.equal(SEA.CALENDAR.length, 24); assert.equal(new Set(SEA.CALENDAR).size, 24, 'each kind once a year');
  assert.deepEqual(Object.keys(SEA.KINDS).sort(), SEA.CALENDAR.slice().sort());
  // Every day of several years (leap years too) has exactly one event, the windows touch with no gaps.
  let prev = null;
  for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2029, 0, 1); t += 86400000) {
    const e = SEA.currentSeason(t + 43200000); assert(e, 'an event on ' + new Date(t).toISOString().slice(0, 10));
    assert(Date.parse(e.start) <= t && t < Date.parse(e.end) + 86400000);
    assert.equal(e.id, e.kind + '-' + e.start.slice(0, 4)); assert.equal(SEA.seasonById(e.id).start, e.start, 'ids round-trip');
    if (prev && prev.id !== e.id) { assert.equal(Date.parse(prev.end) + 86400000, Date.parse(e.start), 'no gap after ' + prev.id); assert.equal(SEA.nextSeason(Date.parse(prev.end)).id, e.id); }
    const d = new Date(t).getUTCDate(); assert.equal(e.start.slice(8), d > 15 ? '16' : '01');
    prev = e;
  }
  const on = (d) => SEA.currentSeason(at(d)).kind;
  assert.equal(on('2026-11-20'), 'harvest', 'today: Harvest Fest (Thanksgiving)'); assert.equal(SEA.currentSeason(at('2026-11-20')).id, 'harvest-2026');
  for (const [d, k] of [['2027-01-01', 'newyear'], ['2027-02-14', 'hearts'], ['2027-03-17', 'clover'], ['2027-04-22', 'earth'], ['2027-07-04', 'fireworks'], ['2027-07-20', 'space'], ['2027-08-12', 'meteor'], ['2027-09-19', 'pirate'], ['2027-10-31', 'spooky'], ['2027-12-25', 'frost'], ['2031-10-05', 'bloodmoon']]) assert.equal(on(d), k, d);
  assert(SEA.CALENDAR.filter((k) => !SEA.KINDS[k].holiday).length >= 4, 'original events fill the gaps');
  assert.equal(SEA.nextOfKind('harvest', at('2026-11-20')).id, 'harvest-2027'); assert.equal(SEA.nextOfKind('frost', at('2026-11-20')).start, '2026-12-16');
  assert.equal(SEA.isSeasonId('s1'), false); assert.equal(SEA.isSeasonId('nope-2026'), false); assert.equal(SEA.seasonById('__proto__-2026'), null);
  assert.equal(SEA.daysLeft(SEA.currentSeason(at('2026-11-20')), at('2026-11-20')), 11);
});

test('every event has 6–10 new items, each a real catalog item, sold by one kind of event only', () => {
  const kinds = new Set(SEA.SEASONS.map((s) => s.kind));
  assert.deepEqual([...kinds].sort(), SEA.CALENDAR.slice().sort());
  const owner = {};
  for (const s of SEA.SEASONS) {
    assert(s.items.length >= 6 && s.items.length <= 10, s.id + ' has ' + s.items.length + ' items');
    for (const id of s.items) {
      const i = item(id); assert(i, id + ' is in the catalog');
      assert(i.special && i.cost > 0 && !i.free && !i.pass && !i.world && !i.achievement, id + ' is a plain paid special item');
      assert(!C.STOCKABLE.includes(i), id + ' is never on the play-to-reveal shelf');
      assert(!owner[id] || owner[id] === s.kind, id + ' belongs to one kind of event'); owner[id] = s.kind;
      assert(typeof C.DESCRIPTIONS[id] === 'string' && C.DESCRIPTIONS[id].length > 10, id + ' has words');
    }
  }
  for (const s of SEA.SEASONS) assert.deepEqual(s.items, SEA.ITEMS[s.kind], s.id + ': the same items every year');
});

test('event items can only be bought while their event runs, stay owned afterwards, and return next year', () => {
  const { s, id, p } = store(); const pumpkin = 'hat:pumpkinCap', beanie = 'hat:snowBeanie';
  s.setClock(() => at('2026-11-10')); // before Harvest Fest (Campfire Nights)
  let r = s.buy(id, pumpkin); assert.equal(r.ok, false); assert.match(r.error, /Limited: sold during Harvest Fest/);
  s.setClock(() => at('2026-11-20')); // during
  assert.equal(SS.limitedInfo(pumpkin, at('2026-11-20')).daysLeft, 11);
  assert.match(s.buy(id, beanie).error, /Frostival/, 'another event’s item is not on sale');
  const before = p.coins; r = s.buy(id, pumpkin); assert(r.ok, r.error); assert.equal(before - p.coins, item(pumpkin).cost);
  s.setClock(() => at('2026-12-20')); // Frostival now: Harvest is over
  assert(p.owned.includes(pumpkin)); assert(s.equip(id, pumpkin, true).ok, 'still wearable after the event'); assert.equal(s.lookOf(id) ? s.lookOf(id).hat : p.avatar.hat, 'pumpkinCap');
  assert.equal(s.validateAvatar(id, { hat: 'pumpkinCap' }).hat, 'pumpkinCap');
  assert(s.buy(id, beanie).ok, 'Frostival items on sale in December');
  const other = store().s, oid = other.create().id; other.grant(oid, 500); other.setClock(() => at('2026-12-20'));
  assert.match(other.buy(oid, pumpkin).error, /back 16 Nov/, 'says when it comes back');
  other.setClock(() => at('2027-11-20')); assert(other.buy(oid, pumpkin).ok, 'Harvest Fest 2027 sells the same item');
  assert.equal(s.validateAvatar(oid, { hat: 'witchHat' }).hat, O.hats[0], 'not owned: cannot be worn');
});

test('daily deals: the same for everyone on a day, new the next day, 2 discounted 20–30%, server-enforced price', () => {
  const d1 = SS.dailyDeals(at('2026-11-19', 1)), d1b = SS.dailyDeals(at('2026-11-19', 23)), d2 = SS.dailyDeals(at('2026-11-20'));
  assert.deepEqual(d1.items, d1b.items, 'deterministic for the whole UTC day');
  assert.notDeepEqual(d1.items.map((x) => x.id), d2.items.map((x) => x.id), 'swaps every day');
  assert.equal(d1.endsAt, at('2026-11-20', 0));
  for (let k = 0; k < 40; k++) {
    const d = SS.dailyDeals(at('2027-01-01') + k * 86400000);
    assert.equal(d.items.length, SS.DEALS.count); assert.equal(new Set(d.items.map((x) => x.id)).size, d.items.length);
    const off = d.items.filter((x) => x.pct); assert.equal(off.length, SS.DEALS.discounted);
    for (const x of off) assert(x.pct >= 20 && x.pct <= 30);
    for (const x of d.items) { const it = item(x.id) || G.BY_ID.get(x.id); assert(it && !it.special && !it.pass && !it.world && !it.achievement, x.id); }
    assert(d.items.some((x) => x.id.startsWith('gear:')) && d.items.some((x) => !x.id.startsWith('gear:')), 'a mix of game gear and character items');
  }
  // Find a day whose discounted character item is still hidden on a new player's shelf, and buy it.
  let day = null, deal = null;
  for (let k = 0; k < 200 && !deal; k++) { const t = at('2027-02-01') + k * 86400000; const x = SS.dailyDeals(t).items.find((y) => y.pct && C.STOCKABLE.some((i) => i.id === y.id) && !C.STARTER_STOCK.includes(y.id)); if (x) { day = t; deal = x; } }
  assert(deal, 'some day discounts a hidden item');
  const { s, id, p } = store(); s.setClock(() => day);
  const pr = SS.priceOf(deal.id, day); assert(pr.cost < item(deal.id).cost && pr.cost === Math.max(5, Math.round(item(deal.id).cost * (1 - deal.pct / 100) / 5) * 5));
  const before = p.coins; assert(s.buy(id, deal.id).ok, 'a deal is on sale even off your shelf'); assert.equal(before - p.coins, pr.cost, 'charged the deal price');
  assert.match(p.ledger[0].reason, /deal −\d+%/);
  // The day after, a hidden item that isn't a deal any more is back behind the shelf.
  const t2 = day + 86400000, hidden = C.STOCKABLE.find((i) => !p.stock.includes(i.id) && !p.owned.includes(i.id) && !SS.isDeal(i.id, t2) && !SS.SET_OF[i.id]);
  s.setClock(() => t2); assert.match(s.buy(id, hidden.id).error, /isn't in the shop yet/);
  // Gear deals too.
  let gd = null, gday = null; for (let k = 0; k < 60 && !gd; k++) { const t = at('2027-03-01') + k * 86400000; const x = SS.dailyDeals(t).items.find((y) => y.pct && y.id.startsWith('gear:')); if (x) { gd = x; gday = t; } }
  assert(gd); s.setClock(() => gday); const b2 = p.coins; assert(s.buyGear(id, gd.id).ok); assert.equal(b2 - p.coins, SS.priceOf(gd.id, gday).cost);
});

test('weekly spotlight: one set a week (35% off its bundle), new on Monday', () => {
  const mon = at('2026-11-16', 0), sun = at('2026-11-22', 23);
  assert.equal(SS.spotlight(mon).set, SS.spotlight(sun).set); assert.equal(SS.spotlight(mon).endsAt, at('2026-11-23', 0));
  const seen = new Set(); for (let w = 0; w < 30; w++) seen.add(SS.spotlight(mon + w * 7 * 86400000).set); assert(seen.size >= 5, 'rotates through the sets');
  const sp = SS.spotlight(mon); assert.equal(SS.bundleOf(sp.set, [], mon).pct, SS.SETS_RULES.spotlightOff);
});

test('theme sets: 3–4 buyable pieces each in different look fields, no piece in two sets', () => {
  assert(SS.SETS.length >= 8 && SS.SETS.length <= 10);
  const seen = new Set();
  for (const s of SS.SETS) {
    assert(s.items.length >= 3 && s.items.length <= 4, s.id); assert(s.game && s.icon && s.name && s.blurb);
    const fields = s.items.map((id) => { const i = item(id); assert(i, id + ' exists'); assert(!i.pass && !i.world && !i.achievement && !i.requires, id + ' is buyable'); assert(!SS.LIMITED[id], id + ' is not limited'); return i.field; });
    assert.equal(new Set(fields).size, fields.length, s.id + ': one piece per look field, so the whole set can be worn');
    for (const id of s.items) { assert(!seen.has(id), id + ' in two sets'); seen.add(id); }
  }
});

test('event sets: one full look per event (one piece per field), bundle only while it runs, bonus in every game during it', () => {
  assert.equal(SS.EVENT_SETS.length, 24);
  for (const s of SS.EVENT_SETS) {
    assert(s.items.length >= 4 && s.items.length <= 5, s.id); assert(s.name && s.icon && s.blurb && s.event);
    const fields = s.items.map((id) => { const i = item(id); assert(i, id); assert.equal(SS.LIMITED[id], s.event, id + ' is that event’s limited item'); return i.field; });
    assert.equal(new Set(fields).size, fields.length, s.id + ': wearable all at once'); assert(fields.includes('hat') && fields.includes('outfit') && fields.includes('effect'), s.id + ' is a full look');
  }
  const { s, id, p } = store(); const harvest = SS.setById('ev-harvest');
  s.setClock(() => at('2026-12-20')); assert(SS.bundleOf('ev-harvest', p.owned, at('2026-12-20')).locked); assert.equal(s.buySet(id, 'ev-harvest').ok, false, 'not out of season');
  s.setClock(() => at('2026-11-20')); const b = SS.bundleOf('ev-harvest', p.owned, at('2026-11-20')); assert.equal(b.locked, null);
  const before = p.coins; const r = s.buySet(id, 'ev-harvest', true); assert(r.ok, r.error); assert.equal(before - p.coins, b.price);
  const look = s.lookOf(id); assert(SS.wearsSet(harvest, look));
  assert.equal(SS.setBonus('trivia', look, 40, at('2026-11-20')).set, 'ev-harvest', 'any game, during Harvest Fest');
  assert.equal(SS.setBonus('trivia', look, 40, at('2026-12-20')), null, 'no bonus after the event');
  s.setClock(() => at('2027-03-01')); assert(s.wearSet(id, 'ev-harvest').ok, 'still owned and wearable all year');
  const ex = SS.shopExtras(at('2026-11-20'), p.owned, look); assert.equal(ex.eventSet, 'ev-harvest'); assert(ex.sets.some((x) => x.id === 'ev-harvest' && x.worn && x.eventOn));
  assert(SS.shopExtras(at('2027-07-20'), [], null).sets.some((x) => x.id === 'ev-space'), 'the running event’s set is on the shelf');
});

test('every event’s pass: its own challenges and a 25-tier track with its items (nameplate free, the rest premium)', () => {
  const X = require('../public/shared/challenges'), PR = require('../box/progress');
  for (const k of SEA.CALENDAR) {
    const e = SEA.seasonById(k + '-2027'), ch = X.eventChallenges(e.id);
    assert.equal(ch.length, 3, k); assert(ch.every((c) => c.id.startsWith('ev:' + k + ':') && c.count > 0), k);
    const track = X.passTrack(e, PR.catalogHas), items = track.flatMap((t) => [t.free && t.free.item, t.premium.item]).filter(Boolean);
    assert.equal(track.length, X.PASS.tiers); assert.deepEqual(items.slice().sort(), e.items.slice().sort(), k + ': every event item is on the pass');
    assert(track.some((t) => t.free && t.free.item && t.free.item.startsWith('nameplate:')), k + ': a free item');
    assert.equal(track[X.PASS.tiers - 1].free.title, e.name + ' Hero');
  }
});

test('set bundle: the missing pieces at 20% off in one purchase (shelf or not), then wear the whole set', () => {
  const { s, id, p } = store(); const t = at('2026-11-19'); s.setClock(() => t);
  const set = SS.SETS.find((x) => SS.spotlight(t).set !== x.id && x.items.length === 4);
  const first = set.items.find((i) => !item(i).free); assert(s.buy(id, first).ok, 'a set piece can be bought alone, even off the shelf');
  const b = SS.bundleOf(set.id, p.owned, t);
  assert.equal(b.missing.length, set.items.filter((i) => !item(i).free).length - 1);
  assert.equal(b.full, b.missing.reduce((n, i) => n + item(i).cost, 0)); assert.equal(b.pct, SS.SETS_RULES.bundleOff);
  assert.equal(b.price, Math.round(b.full * 0.8 / 5) * 5);
  const before = p.coins; const r = s.buySet(id, set.id, true); assert(r.ok, r.error);
  assert.equal(before - p.coins, b.price, 'charged the bundle price once'); assert.match(p.ledger[0].reason, new RegExp(set.name + ' set'));
  for (const i of set.items) assert(p.owned.includes(i) || item(i).free);
  assert(SS.wearsSet(set, s.lookOf(id)), 'wearing the whole set'); assert.deepEqual(SS.wornSets(s.lookOf(id)).map((x) => x.id), [set.id]);
  assert.match(s.buySet(id, set.id).error, /already have the whole/); assert.equal(s.buySet(id, 'nope').ok, false);
  const poor = store(10); poor.s.setClock(() => t); assert.match(poor.s.buySet(poor.id, set.id).error, /Not enough JustGold/);
  assert.match(poor.s.wearSet(poor.id, set.id).error, /whole/);
});

test('set bonus: +5% (at least 1, at most 3) in the set’s own game, only for the whole set, paid once', () => {
  const ww = SS.setById('wildwest'), look = { hat: 'cowboy', outfit: 'sheriff', accessory: 'lasso', shoeStyle: 'spurBoots' };
  assert.deepEqual(GOLD.withSetBonus('quickdraw', 10, look), { n: 11, bonus: { set: 'wildwest', icon: ww.icon, name: ww.name, extra: 1 } });
  assert.equal(GOLD.withSetBonus('quickdraw', 40, look).n, 42); assert.equal(GOLD.withSetBonus('quickdraw', 400, look).n, 403, 'capped at 3');
  assert.equal(GOLD.withSetBonus('blackjack', 40, look).bonus, null, 'only in its own game');
  assert.equal(GOLD.withSetBonus('quickdraw', 40, { ...look, shoeStyle: 'simple' }).bonus, null, 'the whole set');
  assert.equal(GOLD.withSetBonus('quickdraw', 40, null).bonus, null); assert.equal(GOLD.withSetBonus('quickdraw', 0, look).n, 0);
  // Through a real box game: the bonus lands in the ledger once.
  const { VirtualClock } = require('../clock'), { BoxRoom } = require('../box/room'), { GAMES } = require('../box'), { BoxProfileStore } = require('../box/profiles');
  const clock = new VirtualClock(), wallets = new ProfileStore(null), accounts = new BoxProfileStore(null);
  const room = new BoxRoom('SETB', GAMES.quickdraw, { clock, seed: 3, profiles: accounts, wallets }), ps = [];
  for (let i = 0; i < 2; i++) { const p = room.join('P' + i).player; p.sockets = 1; const acc = accounts.create('P' + i), w = wallets.create(); accounts.setWallet(acc.id, w.id); p.profileId = acc.id; p.wallet = w.id; ps.push(p); }
  ps[0].look = { ...wallets.lookOf(ps[0].wallet) || {}, ...look };
  room.gameStartAt = room.now() - 10 * 60000; room.gameNo = 1;
  room.payGold('quickdraw', ps.map((p) => p.id));
  const led = wallets.data.profiles[ps[0].wallet].ledger[0], base = GOLD.goldFor('quickdraw', 1, 2, 10 * 60000);
  assert.equal(led.delta, base + 1); assert.match(led.reason, /🤠 set \+1/); assert.equal(ps[0].jg.set.extra, 1);
  assert.equal(wallets.data.profiles[ps[1].wallet].ledger[0].delta, GOLD.goldFor('quickdraw', 2, 2, 10 * 60000), 'no set, no bonus');
  const coins = wallets.coins(ps[0].wallet); room.payGold('quickdraw', ps.map((p) => p.id)); assert.equal(wallets.coins(ps[0].wallet), coins, 'paid once');
});

test('every new item is drawn: hats, outfits, extras, shoes and effects change the character; nameplates have styles', () => {
  // A stub canvas that counts drawing calls; avatar.js runs in a small window sandbox.
  let calls = 0;
  const grad = { addColorStop() {} };
  const ctx = new Proxy({}, { get(t, k) { if (k in t) return t[k]; if (['createLinearGradient', 'createRadialGradient'].includes(k)) return () => grad; return () => { calls++; }; }, set(t, k, v) { t[k] = v; return true; } });
  const win = {}; win.window = win; vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'avatar.js'), 'utf8'), win);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'avatar-events.js'), 'utf8'), win); // events v2 items
  const base = { body: 'male', hat: 'none', outfit: 'shirt', accessory: 'none', effect: 'none', shoeStyle: 'simple', hair: 'short' };
  const count = (look, t = 1.3) => { calls = 0; win.MTArt.drawCharacter(ctx, 0, 0, look, { t }); return calls; };
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'shop', 'shop.css'), 'utf8'), town = fs.readFileSync(path.join(__dirname, '..', 'public', 'town.js'), 'utf8');
  for (const i of C.CATALOG.filter((x) => x.special)) {
    if (i.field === 'nameplate') { assert(css.includes('.np-' + i.value + ' '), i.id + ' has a shop style'); assert(town.includes(i.value + ': '), i.id + ' has a town colour'); continue; }
    for (const body of ['male', 'female']) {
      const b = { ...base, body, hair: body === 'female' ? 'long' : 'short' };
      // effects move: some frames may have nothing in front, so look at several moments
      const differs = [0.4, 1.3, 2.9, 4.1].some((t) => count({ ...b, [i.field]: i.value }, t) !== count(b, t));
      assert(differs, i.id + ' draws something on a ' + body + ' character');
    }
  }
});

// ---- over real sockets: what the shop page gets, bundles and wearing a set ----
const PORT = 3971, URL = `http://127.0.0.1:${PORT}`;
const emit = (s, ev, msg) => new Promise((res) => s.emit(ev, msg, (r) => res(r)));
const connect = (ns = '/box') => new Promise((res, rej) => { const s = io(URL + ns, { transports: ['websocket'], forceNew: true, reconnection: false }); s.once('connect', () => res(s)); s.once('connect_error', rej); });
async function socketTests() {
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: String(PORT), MT_PROFILE_STORE: 'memory', MT_DEV_GRANTS: '1' }, stdio: 'pipe' });
  const socks = [];
  try {
    await new Promise((resolve, reject) => { server.stdout.on('data', (b) => { if (String(b).includes('running')) resolve(); }); setTimeout(() => reject(new Error('server did not start')), 8000).unref(); });
    const mafia = await connect('/'); socks.push(mafia);
    const mp = await emit(mafia, 'profile:create', {}); assert((await emit(mafia, 'dev:grant', { amount: 3000 })).ok);
    const ph = await connect(); socks.push(ph);
    const acc = await emit(ph, 'profile:create', { name: 'Sal' }); const auth = { id: acc.id, token: acc.token };
    assert((await emit(ph, 'account:wallet', { auth, mafia: { id: mp.id, token: mp.token } })).ok);
    const st = await emit(ph, 'shop:state', { auth }); assert(st.ok);
    assert.equal(st.deals.items.length, SS.DEALS.count); assert(st.deals.endsAt > Date.now() && st.deals.spotlight.set);
    assert.equal(st.sets.filter((x) => !x.event).length, SS.SETS.length); assert.equal(st.eventSet, 'ev-' + SEA.currentSeason().kind); assert(st.sets.some((x) => x.id === st.eventSet)); assert(st.setRules.bonusPct === 5);
    const cur = SEA.currentSeason();
    if (cur) {
      assert.equal(st.event.id, cur.id); const lim = st.catalog.find((i) => i.id === cur.items[0]);
      assert(lim.limited.onSale && !lim.lock); assert((await emit(ph, 'shop:buy', { auth, itemId: lim.id })).ok);
    } else assert.equal(st.event, null);
    const off = st.catalog.find((i) => i.limited && !i.limited.onSale); assert(off.lock && /Limited/.test(off.lock));
    assert.equal((await emit(ph, 'shop:buy', { auth, itemId: off.id })).ok, false, 'out-of-season items are refused by the server');
    const deal = st.deals.items.find((d) => d.pct);
    const dr = await emit(ph, 'shop:buy', { auth, itemId: deal.id }); assert(dr.ok, dr.error); assert.equal(dr.state.ledger[0].delta, -deal.price);
    const set = st.sets.find((s) => s.id === 'space'), gold0 = dr.state.gold;
    const r = await emit(ph, 'shop:bundle', { auth, setId: 'space', wear: true }); assert(r.ok, r.error);
    const after = r.state.sets.find((s) => s.id === 'space');
    assert(after.worn && after.have === after.total); assert.equal(gold0 - r.state.gold, SS.bundleOf('space', new Set(dr.state.owned)).price);
    assert.equal(r.state.look.hat, 'ufoHat'); assert(set.bundle.price > 0);
    assert.equal((await emit(ph, 'shop:bundle', { auth, setId: '__proto__' })).ok, false);
    assert.equal((await emit(ph, 'shop:wearSet', { auth, setId: 'royal' })).ok, false, 'not owned');
    assert.equal((await emit(ph, 'shop:bundle', { auth: { id: acc.id, token: 'x' }, setId: 'space' })).ok, false);
  } finally { for (const s of socks) s.close(); server.kill(); }
}

(async () => {
  for (const [name, fn] of tests) { fn(); passed++; console.log(`  ✓ ${name}`); }
  await socketTests(); passed++; console.log('  ✓ over sockets: shop state, limited refusals, deal prices, bundles');
  console.log(`All ${passed} shop season tests passed.`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
