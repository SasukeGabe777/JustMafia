'use strict';
// Themes v2: every world has its own names, narrator voice, layout and earnable gear;
// the classic look (Medieval Village "Mafia Town", Small Town) is untouched.
const assert = require('node:assert/strict');
const T = require('../public/shared/themes');
const R = require('../public/shared/roles');
const L = require('../public/shared/layout');
const C = require('../public/shared/cosmetics');
const O = require('../public/shared/options');
const N = require('../narrator');
const { ProfileStore } = require('../profiles');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };
const WORLDS = ['space', 'fantasy', 'dragons', 'dungeon', 'spies', 'fbi', 'snow', 'blocky', 'tabletop', 'realistic', 'noir'];
const KEYS = ['start', 'night', 'kill', 'multiKill', 'saved', 'eliminated', 'townWin', 'mafiaWin', 'kill_lake', 'kill_hearth', 'kill_tavern', 'kill_field', 'kill_chase', 'kill_visit'];

test('Five new worlds are selectable (snowy, block, tabletop, realistic, noir) alongside the others', () => {
  for (const id of WORLDS) { assert(T.THEME_ORDER.includes(id), id); const t = T.THEMES[id]; assert(t.townName && t.palette && t.night && t.labels.cemetery, id); }
  assert.equal(T.THEMES.blocky.building, 'block');
});

test('Every world renames every role, shown as "Themed Name (Role)" so players know what it does', () => {
  for (const id of WORLDS) {
    for (const role of Object.keys(R.ROLES)) {
      const base = R.ROLES[role].name, shown = T.roleName(id, role, base), title = T.roleTitle(id, role, base);
      assert(title && title !== base, `${id}/${role} has a themed name`);
      assert.equal(shown, `${title} (${base})`);
    }
    assert(T.teamName(id, 'mafia', 'Mafia') !== 'Mafia', `${id} names its Mafia`);
  }
});

test('The classic look stays exactly as it was (no renames, classic narrator)', () => {
  for (const id of ['medieval', 'smalltown']) {
    assert.equal(T.roleName(id, 'doctor', 'Doctor'), 'Doctor'); assert.equal(T.teamName(id, 'mafia', 'The Mafia'), 'The Mafia');
    assert(!T.THEMES[id].narration);
  }
  assert.equal(T.THEMES.medieval.townName, 'Oakhollow'); assert.equal(T.THEMES.smalltown.townName, 'Mafia Town');
});

test('The narrator speaks in each world’s voice, and its kills match how that world kills', () => {
  const death = { space: /blaster|vapori|dust|disintegrat/i, dragons: /fire|ash|ember|flame/i, snow: /ice|froz|frost|shatter|icicle/i, blocky: /cube|block|pixel/i, tabletop: /arrow|20|critical|crit|roll/i, noir: /revolver|rain|streetlamp|gun|shot|lead/i, fbi: /chalk|revolver|shot/i, dungeon: /poison|venom|blade/i, fantasy: /stone|curse|petrif/i, spies: /silenc|laser|dot|suppress/i, realistic: /knife|blade|dawn/i };
  for (const id of WORLDS) {
    for (const key of KEYS) assert((T.THEMES[id].narration[key] || []).length, `${id} narrates ${key}`);
    const line = N.line('classic', 'kill', { theme: id, name: 'Ana', role: ' They were the X.', alive: 5, town: 'Town' }, () => 0);
    assert.match(line, /Ana/); assert.match(line, death[id], `${id} kill line: ${line}`);
    assert.doesNotMatch(line, /\{\w+\}/, 'no leftover placeholders');
  }
  assert.match(N.line('classic', 'night', { theme: 'medieval', town: 'Mafia Town' }, () => 0), /./);
});

test('Each world shifts its pond and graveyard a little; the classic map is restored afterwards', () => {
  const base = { pond: { ...L.POND }, cem: { ...L.CEM } };
  L.applyVariant({ pond: { dx: 10, dy: 10, rx: 112, ry: 66 }, cem: { dy: 20 } });
  assert.equal(L.POND.x, base.pond.x + 10); assert.equal(L.POND.rx, 112); assert.equal(L.CEM.y, base.cem.y + 20);
  assert.equal(L.SPOTS.pond.x, L.POND.x); assert.equal(L.PLACES.lake.water.y, L.POND.y + 6);
  L.applyVariant(null);
  assert.deepEqual({ ...L.POND }, base.pond); assert.deepEqual({ ...L.CEM }, base.cem);
});

test('World gear: two items per world, never sold, earned by finishing games there', () => {
  assert.deepEqual(Object.keys(C.WORLD_REWARDS).sort(), WORLDS.slice().sort());
  for (const [world, list] of Object.entries(C.WORLD_REWARDS)) {
    assert.deepEqual(list.map((r) => r.games), [1, 3]);
    for (const r of list) {
      const item = C.CATALOG.find((i) => i.id === r.item);
      assert(item, r.item); assert.equal(item.world, world); assert.equal(item.cost, 0); assert(!item.free);
      const [field, value] = r.item.split(':'); assert((O[C.FIELDS[field][0]] || []).includes(value)); assert.notEqual(O.label(value), value, 'has a label');
    }
  }
  const s = new ProfileStore(), a = s.create();
  s.grant(a.id, 1000);
  assert.match(s.buy(a.id, 'outfit:parka').error, /finish 3 games in the Snowy Village/);
  const r1 = s.award(a.id, 'g1', { won: false, alive: true, team: 'town', metrics: {}, theme: 'snow' });
  assert.deepEqual(r1.world, { id: 'snow', name: 'Snowy Village', games: 1, items: ['hat:furHat'] });
  s.award(a.id, 'g2', { won: false, alive: true, team: 'town', metrics: {}, theme: 'snow' });
  assert.deepEqual(s.award(a.id, 'g3', { won: false, alive: true, team: 'town', metrics: {}, theme: 'snow' }).world.items, ['outfit:parka']);
  assert.equal(s.validateAvatar(a.id, { outfit: 'parka', hat: 'furHat' }).outfit, 'parka');
  assert.equal(s.award(a.id, 'g4', { won: true, alive: true, team: 'town', metrics: {}, theme: 'medieval' }).world, null, 'classic themes have no world gear');
  const view = s.view(a.id).worlds; assert.equal(view.length, 11);
  assert.deepEqual(view.find((w) => w.id === 'snow').rewards.map((r) => r.owned), [true, true]);
  assert.equal(view.find((w) => w.id === 'noir').games, 0);
});

console.log(`All ${passed} theme tests passed.`);
