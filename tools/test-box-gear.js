'use strict';
// JustGold gear (public/shared/gear.js): the catalog is sane, every game has gear, and a player
// wearing gear plays every game to the end with the gear reaching the TV / phone data. Every game
// has at least one wearable slot (drawn on the character by public/wear-art.js).
//   node tools/test-box-gear.js
const assert = require('node:assert/strict');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const { GAMES } = require('../box');
const G = require('../public/shared/gear');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };
const HEX = /^#[0-9a-f]{6}$/i;
// Games that never end on their own with bots alone in a short run: played for a while instead.
const LONG = new Set(['kingdoms', 'ducks', 'funny']);
// Games whose gear ships before the game itself (built on another branch).
const FUTURE = new Set(['pizza']);
// The wearable shapes public/wear-art.js knows (W.<shape> = …).
const SHAPES = new Set([...require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public', 'wear-art.js'), 'utf8').matchAll(/\bW\.(\w+) = /g)].map((m) => m[1]));

test('catalog: unique ids, valid fields, prices 40–300', () => {
  const ids = new Set();
  for (const g of G.GEAR) {
    assert(!ids.has(g.id), 'duplicate id ' + g.id); ids.add(g.id);
    assert.equal(g.id, `gear:${g.game}:${g.value}`);
    assert(G.slotsOf(g.game).includes(g.slot), g.id + ': unknown slot ' + g.slot);
    assert(typeof g.name === 'string' && g.name.length >= 3 && g.name.length <= 24, g.id + ' name');
    assert(typeof g.desc === 'string' && g.desc.length >= 8, g.id + ' desc');
    assert(typeof g.icon === 'string' && g.icon.length, g.id + ' icon');
    assert(Number.isInteger(g.cost) && g.cost >= 40 && g.cost <= 300, g.id + ' price ' + g.cost);
    assert(['tv', 'phone'].includes(g.where), g.id + ' where');
    assert.notEqual(g.value, 'classic', 'classic is the free default');
    assert(/^[a-z0-9]+$/i.test(g.value), g.id + ' value is a small key');
  }
  // Names are unique within a game.
  for (const s of G.GAMES_WITH_GEAR) {
    const names = G.GEAR.filter((g) => g.game === s.game).map((g) => g.name);
    assert.equal(new Set(names).size, names.length, s.game + ': duplicate names');
  }
});

test('catalog: every paint is data the renderers accept (hex colours, known patterns, emoji, pen lists)', () => {
  for (const g of G.GEAR) {
    const p = g.paint; assert(p && typeof p === 'object', g.id);
    for (const k of Object.keys(p)) assert(['a', 'b', 'c', 'pattern', 'icon', 'glow', 'pens', 'shape', 'd'].includes(k), g.id + ': unknown paint field ' + k);
    if (g.spot) { assert(G.SPOTS.includes(g.spot), g.id + ' spot'); assert(SHAPES.has(p.shape), g.id + ': wear-art.js has no shape ' + p.shape); } else assert(!('shape' in p), g.id + ': an object slot item has no shape');
    if ('d' in p) assert(/^[a-z]+$/.test(p.d), g.id + ' d');
    for (const k of ['a', 'b', 'c']) if (k in p) assert(HEX.test(p[k]), g.id + ' ' + k + ' ' + p[k]);
    if ('pattern' in p) assert(G.PATTERNS.includes(p.pattern), g.id + ' pattern ' + p.pattern);
    if ('icon' in p) assert(typeof p.icon === 'string' && p.icon.length <= 8 && !/[<>&"']/.test(p.icon), g.id + ' icon');
    if ('glow' in p) assert.equal(typeof p.glow, 'boolean');
    if ('pens' in p) { assert(Array.isArray(p.pens) && p.pens.length >= 1 && p.pens.length <= 6); for (const c of p.pens) assert(HEX.test(c), g.id + ' pen ' + c); }
    if (g.slot === 'pens') assert(p.pens, g.id + ' a pen set lists its pens');
    if (g.slot === 'theme') assert(HEX.test(p.a) && HEX.test(p.b), g.id + ' a theme has two colours');
    if (g.game === 'kingdoms' && g.slot === 'crest') assert(p.icon, g.id + ' a crest has an emblem');
  }
});

test('every box game (and Ducks, Kingdoms) has character wearables, 1–5 items per slot, with a free default', () => {
  for (const key of [...Object.keys(GAMES), ...FUTURE]) {
    const slots = G.slotsOf(key); assert(slots.length >= 1, key + ' has no gear');
    assert(G.GAMES_WITH_GEAR.some((s) => s.game === key && s.spot), key + ' has no wearable slot');
    const total = G.GEAR.filter((g) => g.game === key).length; assert(total >= 3 && total <= 12, `${key}: ${total} items`);
    for (const slot of slots) {
      const n = G.GEAR.filter((g) => g.game === key && g.slot === slot).length;
      assert(n >= 1 && n <= 5, `${key}.${slot}: ${n} items`);
      const s = G.GAMES_WITH_GEAR.find((x) => x.game === key && x.slot === slot);
      assert(s.label && s.default.name && s.default.value === 'classic', key + ' default');
    }
  }
  for (const s of G.GAMES_WITH_GEAR) assert(GAMES[s.game] || FUTURE.has(s.game), 'gear for an unknown game ' + s.game);
});

test('gearOf / gearSet / paint read p.gear defensively', () => {
  assert.equal(G.gearOf(null, 'marble', 'skin'), 'classic');
  assert.equal(G.gearOf({}, 'marble', 'skin'), 'classic');
  assert.equal(G.gearOf({ gear: null }, 'marble', 'skin'), 'classic');
  assert.equal(G.gearOf({ gear: { marble: { skin: 'lava' } } }, 'marble', 'skin'), 'lava');
  assert.equal(G.gearOf({ gear: { marble: { skin: 'gear:marble:lava' } } }, 'marble', 'skin'), 'lava', 'an item id works too');
  assert.equal(G.gearOf({ gear: { marble: 'lava' } }, 'marble', 'skin'), 'lava', 'the short { game: value } form works');
  assert.equal(G.gearOf({ gear: { marble: { skin: 'nope' } } }, 'marble', 'skin'), 'classic', 'unknown value → default');
  assert.equal(G.gearOf({ gear: { marble: { skin: 'cherry' } } }, 'plinko', 'ball'), 'classic', 'gear belongs to its game');
  assert.equal(G.gearOf({ gear: { marble: { skin: { evil: 1 } } } }, 'marble', 'skin'), 'classic');
  assert.equal(G.gearOf({ gear: { plinko: { ball: 'cherry' } } }, 'plinko', 'ball'), 'classic', 'another game\'s value is not valid here');
  assert.equal(G.gearOf({ gear: { __proto__: { marble: { skin: 'lava' } } } }, 'marble', 'skin'), 'classic', 'no prototype tricks');
  assert.deepEqual(G.gearSet(null, 'sketch'), { pens: 'classic', beret: 'classic', brush: 'classic' });
  assert.deepEqual(G.gearSet({ gear: { sketch: { pens: 'neon', beret: 'red' } } }, 'sketch'), { pens: 'neon', beret: 'red', brush: 'classic' });
  assert.equal(G.paint('marble', 'skin', 'classic'), null);
  assert.equal(G.paint('marble', 'skin', undefined), null);
  assert.equal(G.paint('marble', 'skin', { skin: 'lava' }).a, '#ff5a1f');
  assert.equal(G.paint('marble', 'skin', 'gear:marble:lava').pattern, 'flame');
  assert.deepEqual(G.gearSet({ gear: { quickdraw: { hat: 'golden' } } }, 'nosuchgame'), {});
});

test('wearOf: the wearables to draw, from a gearSet or a whole p.gear; junk gives none', () => {
  const w = G.wearOf('quickdraw', { quickdraw: { hat: 'golden', badge: 'marshal', hand: 'nope' } });
  assert.deepEqual(w.map((x) => [x.spot, x.shape]), [['head', 'cowboy'], ['chest', 'starBadge']]);
  assert.equal(G.wearOf('quickdraw', { hat: 'gear:quickdraw:rose' })[0].d, 'rose', 'a gearSet and item ids work');
  assert.deepEqual(G.wearOf('marble', { marble: { skin: 'lava' } }), [], 'object slots are not worn');
  for (const junk of [null, undefined, 'x', 42, [], { quickdraw: 'golden' }, { quickdraw: { hat: { x: 1 } } }, { __proto__: { hat: 'golden' } }]) assert.deepEqual(G.wearOf('quickdraw', junk), [], JSON.stringify(junk));
  // Old ids that no longer exist (the phone themes) are ignored.
  assert.deepEqual(G.wearOf('blanks', { blanks: { theme: 'grape' } }), []);
  assert.equal(G.BY_ID.get('gear:blanks:grape'), undefined);
});

// The priciest item of each slot, for every game: what our gearhead wears.
const WORN = {}; for (const g of G.GEAR) { const s = (WORN[g.game] || (WORN[g.game] = {})); const cur = G.itemOf(g.game, g.slot, s[g.slot]); if (!cur || g.cost > cur.cost) s[g.slot] = g.value; }
const has = (obj, slot, value) => JSON.stringify(obj).includes(`"${slot}":"${value}"`);

test('every game: a player wearing gear plays to the end with bots; gear reaches the TV / phone', () => {
  const report = [];
  for (const key of Object.keys(GAMES)) {
    const clock = new VirtualClock(), r = new BoxRoom('GEAR', GAMES[key], { clock, seed: 5 });
    const ana = r.join('Ana').player; ana.gear = JSON.parse(JSON.stringify(WORN)); // set the way the server does
    r.addBots(5);
    // Bots wear it too (some gear only shows when that player acts, e.g. a JustBid paddle when bidding).
    for (const p of r.list()) if (p.bot) p.gear = JSON.parse(JSON.stringify(WORN));
    const s = r.start(); assert(s.ok, key + ': ' + s.error);
    const slots = G.slotsOf(key), seen = { tv: false, view: false };
    const look = () => {
      if (!r.game) return;
      const tv = r.game.tv(), v = r.game.view(ana);
      for (const slot of slots) { if (has(tv, slot, WORN[key][slot])) seen.tv = true; if (has(v, slot, WORN[key][slot])) seen.view = true; }
      // The room hands the player's gear to every screen.
      assert.deepEqual(r.playerState(ana).me.gear, ana.gear, key + ': me.gear');
      assert.deepEqual(r.tvState().players.find((p) => p.id === ana.id).gear, ana.gear, key + ': tv players[].gear');
    };
    let i = 0; const limit = LONG.has(key) ? 20000 : 400000;
    // Quick phases (a JustDrop ball in flight) pass in a few steps: look every step until the gear is seen.
    while (r.game && r.game.phase !== 'over' && clock.step()) { if (++i % 50 === 0 || !(seen.tv || seen.view)) look(); if (i > limit) { if (LONG.has(key)) break; throw new Error(key + ' never ended (' + r.game.phase + ')'); } }
    look();
    if (!LONG.has(key)) assert.equal(r.game.phase, 'over', key + ' finished');
    // Games with an object slot (a marble skin, chips…) copy the gear into their own TV data;
    // wearables reach every screen through the room roster (tvState().players[].gear, checked above).
    const objSlot = G.GAMES_WITH_GEAR.find((x) => x.game === key && !x.spot);
    if (objSlot && objSlot.where === 'tv') assert(seen.tv, key + ': the gear never reached tv()');
    if (objSlot && objSlot.where !== 'tv') assert(seen.view || seen.tv, key + ': the gear never reached view()');
    const tvP = r.tvState().players.find((p) => p.id === ana.id);
    assert(G.wearOf(key, tvP.gear).length >= 1, key + ': nothing to wear from the roster');
    report.push(`${key}${seen.tv ? ' tv' : ''}${seen.view ? ' view' : ''} wear:${G.wearOf(key, tvP.gear).length}`);
  }
  console.log('    ' + report.join(', '));
});

test('a game still runs when p.gear is missing, null or junk', () => {
  for (const key of ['marble', 'plinko', 'president', 'bid', 'tune', 'zombie']) {
    for (const junk of [undefined, null, 'x', { [key]: 42 }, { [key]: { nope: 'x' } }]) {
      const clock = new VirtualClock(), r = new BoxRoom('JUNK', GAMES[key], { clock, seed: 2 });
      const p = r.join('Bo').player; p.gear = junk; r.addBots(3); assert(r.start().ok);
      let i = 0; while (r.game.phase !== 'over' && clock.step()) { if (++i % 200 === 0) { r.game.tv(); r.game.view(p); } if (i > 400000) throw new Error(key + ' never ended'); }
      r.game.tv(); r.game.view(p);
    }
  }
});

console.log(`\nGear: all ${passed} checks passed (${G.GEAR.length} items for ${G.GAMES_WITH_GEAR.length} game slots).`);
