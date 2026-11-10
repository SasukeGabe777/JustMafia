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
    assert.equal(store.validateHome(fresh.id, {}).style, 'windmill');
    store.select(auth.id, { ...store.validateAvatar(auth.id, {}), expression: 'sleepy' });
    assert.equal(new ProfileStore(filename).validateAvatar(auth.id, {}).expression, 'sleepy');
    assert.equal(store.validateAvatar(auth.id, { expression: 'nope', features: 'serious' }).expression, 'serious');
    const restored = new ProfileStore(filename); assert.deepEqual(restored.view(auth.id), store.view(auth.id)); assert(restored.authenticate(auth));
    assert(!('verifier' in restored.view(auth.id)));
  } finally { if (fs.existsSync(filename)) fs.unlinkSync(filename); }
});
