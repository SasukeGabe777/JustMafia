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
    const restored = new ProfileStore(filename); assert.deepEqual(restored.view(auth.id), store.view(auth.id)); assert(restored.authenticate(auth));
    assert(!('verifier' in restored.view(auth.id)));
  } finally { if (fs.existsSync(filename)) fs.unlinkSync(filename); }
});
