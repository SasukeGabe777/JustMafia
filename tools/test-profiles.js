'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path');
const { ProfileStore } = require('../profiles');
test('Server profiles persist rewards, verify identity and validate purchases', () => {
  const filename = path.join(__dirname, '..', '.data', 'profile-test-' + process.pid + '.json');
  try {
    const store = new ProfileStore(filename), auth = store.create();
    assert(!store.authenticate({ id: '__proto__', token: 'a'.repeat(64) })); assert(!store.authenticate({ id: auth.id, token: 'bad' })); assert(store.authenticate(auth));
    assert(!store.buy(auth.id, 'outfit:knight').ok); assert.equal(store.validateAvatar(auth.id, { outfit: 'knight' }).outfit, 'shirt');
    for (let i = 0; i < 5; i++) assert(store.award(auth.id, 'game-' + i, { won: true, alive: true, role: 'mafia', team: 'mafia', metrics: { abilities: 3, saves: 2 } }));
    assert(!store.award(auth.id, 'game-0', { won: true, alive: true }));
    assert(store.buy(auth.id, 'outfit:knight').ok); assert.equal(store.validateAvatar(auth.id, { outfit: 'knight' }).outfit, 'knight');
    assert(store.view(auth.id).achievements.includes('mafiaWins5'));
    // House design is separate from the avatar and persists in the profile.
    const home = store.validateHome(auth.id, { style: 'bakery', wall: '#a88bc6', roof: '#3f6b4a', door: 'round', windows: 'shuttered', yard: 'well' });
    assert.deepEqual(home, { style: 'bakery', wall: '#a88bc6', roof: '#3f6b4a', door: 'round', windows: 'shuttered', yard: 'well' });
    store.selectHome(auth.id, home); assert.equal(new ProfileStore(filename).validateHome(auth.id, {}).door, 'round');
    assert(!('houseStyle' in store.validateAvatar(auth.id, { houseStyle: 'bakery' })), 'home fields no longer live on the avatar');
    const bad = store.validateHome(auth.id, { style: 'castle', wall: 'url(x)', door: '<b>', decor: 'heraldry' });
    assert.equal(bad.style, 'bakery'); assert.equal(bad.wall, '#a88bc6'); assert.equal(bad.door, 'round'); // invalid input keeps the saved value
    assert.equal(bad.decor, undefined, 'shop decor requires ownership');
    const fresh = store.create(); store.data.profiles[fresh.id].avatar.houseStyle = 'windmill'; // legacy profile
    store.data.profiles[fresh.id].owned.push('houseStyle:windmill'); // a legacy profile owns what was free when it was created
    assert.equal(store.validateHome(fresh.id, {}).style, 'windmill');
    store.select(auth.id, { ...store.validateAvatar(auth.id, {}), expression: 'sleepy' });
    assert.equal(new ProfileStore(filename).validateAvatar(auth.id, {}).expression, 'sleepy');
    assert.equal(store.validateAvatar(auth.id, { expression: 'nope', features: 'serious' }).expression, 'serious');
    // Gold pouch: earned/spent/balance and a ledger; unaffordable buys change nothing.
    const g = store.create(), P = () => store.view(g.id);
    assert.equal(P().coins, 0); assert.equal(P().goldEarned, 0); assert.equal(P().goldSpent, 0);
    const before = JSON.stringify(P());
    const poor = store.buy(g.id, 'houseStyle:darkMansion'); assert.equal(poor.ok, false); assert.match(poor.error, /Not enough gold/);
    assert.equal(JSON.stringify(P()), before, 'failed purchase leaves gold and inventory unchanged');
    assert(store.award(g.id, 'g-1', { won: true, alive: true, team: 'town', metrics: { abilities: 1 } }));
    const earned = P().coins; assert(earned > 0); assert.equal(P().goldEarned, earned); assert.equal(P().ledger[0].reason, 'Game reward');
    assert(store.grant(g.id, 200)); assert.equal(P().coins, earned + 200);
    const price = require('../public/shared/cosmetics').CATALOG.find((i) => i.id === 'houseStyle:darkMansion').cost;
    assert(store.buy(g.id, 'houseStyle:darkMansion').ok);
    assert.equal(P().coins, earned + 200 - price); assert.equal(P().goldSpent, price); assert.equal(P().goldEarned - P().goldSpent, P().coins);
    assert.equal(P().ledger[0].delta, -price); assert.equal(P().ledger[0].item, 'houseStyle:darkMansion');
    assert.equal(store.buy(g.id, 'houseStyle:darkMansion').ok, false, 'cannot buy twice');
    // Inventory + equip/unequip (house item and character item); unowned items cannot be equipped.
    assert.deepEqual(P().inventory.map((i) => i.id), ['houseStyle:darkMansion']); assert.equal(P().inventory[0].equipped, false);
    assert.equal(store.equip(g.id, 'outfit:knight').ok, false);
    const eq = store.equip(g.id, 'houseStyle:darkMansion'); assert(eq.ok); assert.equal(eq.target, 'home'); assert.equal(P().home.style, 'darkMansion'); assert.equal(P().inventory[0].equipped, true);
    assert(store.equip(g.id, 'houseStyle:darkMansion', false).ok); assert.equal(P().home.style, 'cottage'); assert.equal(P().inventory[0].equipped, false);
    assert(store.buy(g.id, 'hat:hood').ok); assert(store.equip(g.id, 'hat:hood').ok); assert.equal(P().avatar.hat, 'hood');
    assert.equal(new ProfileStore(filename).view(g.id).avatar.hat, 'hood', 'equipped items persist');
    // Older profiles get pouch fields on load (their balance counts as earned).
    store.data.profiles[g.id].goldEarned = undefined; store.data.profiles[g.id].ledger = undefined; store.save();
    const migrated = new ProfileStore(filename).view(g.id); assert.equal(migrated.goldEarned, migrated.coins); assert.deepEqual(migrated.ledger, []);
    const restored = new ProfileStore(filename); assert.deepEqual(restored.view(auth.id), store.view(auth.id)); assert(restored.authenticate(auth));
    assert(!('verifier' in restored.view(auth.id)));
  } finally { if (fs.existsSync(filename)) fs.unlinkSync(filename); }
});
