'use strict';
// Shop reveal: gold items start hidden; playing puts more on each player's shelves.
const assert = require('node:assert/strict');
const C = require('../public/shared/cosmetics');
const { ProfileStore } = require('../profiles');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };
const game = (extra = {}) => ({ won: false, alive: true, team: 'town', metrics: {}, ...extra });

test('A new player sees a small starter shelf: two of the cheapest items of each kind', () => {
  assert(C.STOCKABLE.length > 80, 'most gold items are hidden at first');
  assert.equal(C.STARTER_STOCK.length, Object.keys(C.FIELDS).filter((f) => C.STOCKABLE.some((i) => i.field === f)).length * 2);
  for (const id of C.STARTER_STOCK) { const i = C.CATALOG.find((x) => x.id === id); assert(i.cost > 0 && !i.pass && !i.world && !i.achievement, id); }
  const s = new ProfileStore(), a = s.create();
  assert.deepEqual(s.view(a.id).stock, C.STARTER_STOCK);
});

test('Hidden items cannot be bought; stocked ones can', () => {
  const s = new ProfileStore(), a = s.create(); s.grant(a.id, 2000);
  const hidden = C.STOCKABLE.find((i) => !C.STARTER_STOCK.includes(i.id));
  assert.match(s.buy(a.id, hidden.id).error, /isn't in the shop yet/);
  assert(s.buy(a.id, C.STARTER_STOCK[0]).ok);
});

test('Every finished game reveals 1 item, a win 1 more, a first visit to a world 2 more', () => {
  const s = new ProfileStore(), a = s.create(), shelf = () => s.view(a.id).stock.length;
  const n0 = shelf();
  assert.equal(s.award(a.id, 'g1', game()).stock.length, 1);
  assert.equal(s.award(a.id, 'g2', game({ won: true })).stock.length, 2);
  assert.equal(s.award(a.id, 'g3', game({ won: true, theme: 'noir' })).stock.length, 4, 'win in a new world');
  assert.equal(s.award(a.id, 'g4', game({ theme: 'noir' })).stock.length, 1, 'the second visit is a normal game');
  assert.equal(shelf(), n0 + 8);
  const r = s.award(a.id, 'g5', game({ won: true }));
  for (const id of r.stock) { const i = C.CATALOG.find((x) => x.id === id); assert(C.STOCKABLE.includes(i)); }
  assert.equal(new Set(s.view(a.id).stock).size, shelf(), 'never the same item twice');
});

test('Reveals mix kinds, cheapest first, and stop when everything is out', () => {
  const next = C.nextStock(C.STARTER_STOCK, 6), fields = new Set(next.map((id) => id.split(':')[0]));
  assert(fields.size >= 5, 'a mix of clothes, hats, hair, houses...');
  const all = C.nextStock([], 1000); assert.equal(all.length, C.STOCKABLE.length);
  assert.deepEqual(C.nextStock(all, 3), []);
});

test('Older profiles get the starter shelf plus what their past games would have revealed', () => {
  const fs = require('node:fs'), path = require('node:path');
  const file = path.join(__dirname, '..', '.data', 'stock-test-' + process.pid + '.json');
  try {
    const s = new ProfileStore(file), a = s.create(), p = s.data.profiles[a.id];
    delete p.stock; p.stats.games = 4; p.stats.wins = 2; s.save(); // saved before the shop reveal existed
    const migrated = new ProfileStore(file).view(a.id).stock;
    assert.equal(migrated.length, C.STARTER_STOCK.length + 4 * C.STOCK.finished + 2 * C.STOCK.won);
    assert.deepEqual(migrated.slice(0, C.STARTER_STOCK.length), C.STARTER_STOCK);
  } finally { if (fs.existsSync(file)) fs.unlinkSync(file); }
});

console.log(`All ${passed} shop stock tests passed.`);
