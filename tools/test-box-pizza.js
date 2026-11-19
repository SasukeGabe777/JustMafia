'use strict';
// YesChef rules (key `pizza`): the match score of every kitchen, every kitchen × every mode played
// to the end by bots on a virtual clock, the food court rotating, the secret order kept off the
// TV, junk input, disconnects, Party Mode.  node tools/test-box-pizza.js
const assert = require('node:assert/strict');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/pizza');
const { match, clean, describe, rot, flip, MODES, TOPPINGS, WHOLE, HALVES, QUARTERS, KITCHENS, KITCHEN_KEYS, LINES, CUSTOMERS } = def._test;
let passed = 0;
const test = (n, fn) => { fn(); passed++; console.log('  ✓ ' + n); };
const pz = (crust, sauce, cheese, top = {}) => ({ crust, sauce, cheese, top });
function run(room, clock, until = () => room.game.phase === 'over') { let i = 0; while (!until() && clock.step()) if (++i > 200000) throw new Error('never ended'); }
function game(settings = {}, bots = 5, seed = 1) {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed });
  for (const [k, v] of Object.entries(settings)) room.settings[k] = v;
  room.addBots(bots);
  return { clock, room };
}
const startGame = (room) => { const r = room.start(); assert(r.ok, r.error); assert.equal(room.phase, 'game'); };

// ---------------- the score ----------------
test('match: the same pizza is 100; nothing at all is 0', () => {
  const o = pz('thin', 'tomato', 1, { pepperoni: WHOLE, mushroom: HALVES[0] });
  assert.equal(match(o, o), 100);
  assert.equal(match(o, null), 0);
  assert.equal(match(null, o), 0);
});
test('match: a bare dough scores low; each part adds up in order', () => {
  const o = pz('classic', 'tomato', 1, { pepperoni: WHOLE, olive: HALVES[1] });
  const bare = match(o, pz('classic', 'none', 0, {}));
  assert(bare < 20, 'bare dough ' + bare);
  const sauced = match(o, pz('classic', 'tomato', 0, {}));
  const cheesy = match(o, pz('classic', 'tomato', 1, {}));
  const one = match(o, pz('classic', 'tomato', 1, { pepperoni: WHOLE }));
  assert(bare < sauced && sauced < cheesy && cheesy < one && one < 100, [bare, sauced, cheesy, one].join(' < '));
});
test('match: crust, sauce and cheese are partly forgiving', () => {
  const o = pz('classic', 'pesto', 2, { basil: WHOLE });
  assert.equal(match(o, pz('thin', 'pesto', 2, { basil: WHOLE })), 100 - Math.round(8 * 0.6)); // a neighbouring crust keeps 40%
  assert.equal(match(o, pz('classic', 'pesto', 1, { basil: WHOLE })), 95); // one step of cheese off
  assert.equal(match(o, pz('classic', 'bbq', 2, { basil: WHOLE })), 88);
});
test('match: placement counts, but any turn or flip of the pie is the same pizza', () => {
  const o = pz('deep', 'tomato', 1, { pepperoni: HALVES[0], mushroom: HALVES[1] });
  const swapped = pz('deep', 'tomato', 1, { pepperoni: HALVES[1], mushroom: HALVES[0] });
  assert.equal(match(o, swapped), 100, 'the other way round is the same half & half');
  const q = pz('thin', 'white', 1, { ham: QUARTERS[0], olive: QUARTERS[1], onion: QUARTERS[2], basil: QUARTERS[3] });
  const turned = pz('thin', 'white', 1, { ham: rot(QUARTERS[0], 2), olive: rot(QUARTERS[1], 2), onion: rot(QUARTERS[2], 2), basil: rot(QUARTERS[3], 2) });
  const mirrored = pz('thin', 'white', 1, { ham: flip(QUARTERS[0]), olive: flip(QUARTERS[1]), onion: flip(QUARTERS[2]), basil: flip(QUARTERS[3]) });
  assert.equal(match(q, turned), 100); assert.equal(match(q, mirrored), 100);
  const muddled = pz('thin', 'white', 1, { ham: QUARTERS[0], olive: QUARTERS[2], onion: QUARTERS[1], basil: QUARTERS[3] });
  assert(match(q, muddled) < 100 && match(q, muddled) > 60, 'quarters in the wrong order: ' + match(q, muddled));
  const everywhere = pz('deep', 'tomato', 1, { pepperoni: WHOLE, mushroom: WHOLE });
  assert(match(o, everywhere) < match(o, swapped), 'both toppings all over is worse than halves');
});
test('match: missing, extra and wrong toppings cost points; amounts matter', () => {
  const o = pz('classic', 'tomato', 1, { pepperoni: WHOLE, pepper: WHOLE });
  const missing = match(o, pz('classic', 'tomato', 1, { pepperoni: WHOLE }));
  const extra = match(o, pz('classic', 'tomato', 1, { pepperoni: WHOLE, pepper: WHOLE, pineapple: WHOLE }));
  const wrong = match(o, pz('classic', 'tomato', 1, { ham: WHOLE, jalapeno: WHOLE }));
  const half = match(o, pz('classic', 'tomato', 1, { pepperoni: WHOLE, pepper: HALVES[0] }));
  assert(wrong < missing && missing < half && half < 100, [wrong, missing, half].join(' '));
  assert(extra < 100 && extra > wrong);
  for (const x of [missing, extra, wrong, half]) assert(Number.isInteger(x) && x >= 0 && x <= 100);
});
test('match: deterministic and symmetric enough over random pizzas', () => {
  let s = 7; const r = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const rand = () => { const t = {}; for (const k of TOPPINGS) if (r() < 0.3) t[k] = 1 + Math.floor(r() * 255); return pz(['thin', 'classic', 'deep'][Math.floor(r() * 3)], ['tomato', 'white', 'pesto', 'bbq', 'none'][Math.floor(r() * 5)], Math.floor(r() * 3), t); };
  for (let i = 0; i < 300; i++) { const a = rand(), b = rand(); const m = match(a, b); assert.equal(m, match(a, b)); assert.equal(m, match(b, a)); assert(m >= 0 && m <= 100); assert.equal(match(a, a), 100); }
});
test('clean(): junk input becomes a safe pizza or null', () => {
  for (const bad of [null, undefined, 5, 'pizza', [], true]) assert.equal(clean(bad), null);
  const c = clean({ crust: 'stuffed', sauce: '<script>', cheese: 9, top: { pepperoni: 999, olive: -1, ham: 1.5, mushroom: 0x0f, anchovy: 255, __proto__: { x: 1 } }, extra: 'x'.repeat(1e5) });
  assert.deepEqual(c, { crust: 'classic', sauce: 'none', cheese: 0, top: { mushroom: 0x0f } });
  assert.deepEqual(clean({ top: [1, 2, 3] }).top, {});
});
test('describe(): the order in words names everything on it', () => {
  const o = { crust: 'deep', sauce: 'bbq', cheese: 2, top: {}, sections: [{ kind: 'whole', mask: WHOLE, kinds: ['ham'] }, { kind: 'half', mask: HALVES[0], kinds: ['olive'] }, { kind: 'half', mask: HALVES[1], kinds: ['pineapple', 'onion'] }] };
  const w = describe(o);
  for (const bit of ['deep dish', 'barbecue', 'extra cheese', 'ham all over', 'black olives on one half', 'pineapple and red onion on the other half']) assert(w.includes(bit), w);
  assert(/no cheese/.test(describe({ crust: 'thin', sauce: 'none', cheese: 0, sections: [] })));
});

// ---------------- whole games ----------------
for (const kitchen of [...KITCHEN_KEYS, 'surprise', 'court']) for (const mode of [...Object.keys(MODES), 'mixed']) {
  test(`${kitchen} × ${mode}: bots play every order to the end; results() lists everyone best-first`, () => {
    const { clock, room } = game({ kitchen, mode, rounds: 3, seconds: 30 }, 5, mode.length + kitchen.length);
    startGame(room); run(room, clock);
    const g = room.game, res = g.results();
    assert.equal(res.length, 5);
    const pts = res.map((id) => g.points.get(id));
    for (let i = 1; i < pts.length; i++) assert(pts[i - 1] >= pts[i]);
    assert.equal(g.round, mode === 'rush' ? 6 : 3);
    assert(pts[0] > 0, 'somebody scored');
    if (mode !== 'mixed') assert(g.history.every((h) => h.mode === mode || (mode === 'chef' && h.mode === 'phone')), JSON.stringify(g.history));
    assert(g.final && g.final.awards.length >= 1);
    if (KITCHENS[kitchen]) assert(g.history.every((h) => h.kitchen === kitchen), 'one kitchen all game');
    for (const h of g.history) assert(KITCHENS[h.kitchen]);
  });
}

test('the secret order: never on the TV while cooking; shown at the right moments', () => {
  const { clock, room } = game({ mode: 'classic', rounds: 1, seconds: 30 }, 3);
  startGame(room);
  const g = room.game; assert.equal(g.phase, 'order');
  assert(!g.tv().c.order, 'not while the customer walks in');
  run(room, clock, () => g.tv().c.order); assert.equal(g.phase, 'order');
  run(room, clock, () => g.phase === 'build');
  const t = g.tv(); assert(!t.c.order && !t.c.words, 'hidden while cooking');
  assert(!JSON.stringify(t).includes(g.c.order.words));
  for (const p of room.list()) assert(!g.view(p).c.ticket && !g.view(p).c.order, 'phones do not get it either');
  run(room, clock, () => g.phase === 'reveal'); assert(g.tv().c.order && g.tv().c.rows.length === 3);
});
test('phone order: words, no picture; head chef: only the chef’s phone has the ticket', () => {
  let { clock, room } = game({ mode: 'phone', rounds: 1 }, 3);
  startGame(room); let g = room.game;
  run(room, clock, () => g.tv().c.words); assert(!g.tv().c.order);
  ({ clock, room } = game({ mode: 'chef', rounds: 3 }, 0));
  const a = room.join('Ana').player, b = room.join('Ben').player, cc = room.join('Cy').player; for (const p of [a, b, cc]) p.sockets = 1;
  room.addBots(2); startGame(room); g = room.game;
  const chef = room.get(g.c.chef); assert(chef && !chef.bot, 'a human is head chef');
  assert(g.view(chef).c.isChef && g.view(chef).c.ticket && g.view(chef).c.ticket.words);
  for (const p of room.list()) if (p.id !== chef.id) assert(!g.view(p).c.ticket);
  run(room, clock, () => g.phase === 'build');
  assert(!g.tv().c.words && !g.tv().c.order, 'the chef describes it; the TV keeps it secret');
  assert.equal(room.act(chef, { op: 'serve', pizza: { crust: 'thin' } }).ok, false, 'the chef does not cook');
  chef.sockets = 0; assert(g.tv().c.words, 'chef gone: the ticket is read out on the TV');
  chef.sockets = 1;
  for (const p of [a, b, cc]) if (p.id !== chef.id) room.act(p, { op: 'serve', pizza: g.c.order });
  run(room, clock, () => g.phase === 'reveal');
  assert(g.c.chefRow && g.c.chefRow.id === chef.id && g.c.chefRow.gain > 0);
  run(room, clock, () => g.phase === 'order' && g.round === 2);
  assert.notEqual(g.c.chef, chef.id, 'the head chef rotates');
});
test('a perfect pizza wins the round and the best-pizza bonus; rush pays for speed', () => {
  const { clock, room } = game({ mode: 'rush', rounds: 3, seconds: 30 }, 2);
  const me = room.join('Ana').player; me.sockets = 1; startGame(room); const g = room.game;
  run(room, clock, () => g.phase === 'build');
  assert.equal(room.act(me, { op: 'serve', pizza: g.c.order }).ok, true);
  run(room, clock, () => g.phase === 'reveal');
  const r = g.c.rows.find((x) => x.id === me.id);
  assert.equal(r.score, 100); assert(r.best); assert(r.speed > 0, 'served at once: a speed tip'); assert.equal(r.gain, 1000 + r.speed + 150);
  assert.equal(g.view(me).c.mine.score, 100);
});
test('phone input: drafts count at the buzzer; junk, wrong phase and double serves are refused', () => {
  const { clock, room } = game({ mode: 'classic', rounds: 1 }, 2);
  const me = room.join('Ana').player, lazy = room.join('Bo').player; me.sockets = 1; lazy.sockets = 1; startGame(room); const g = room.game;
  assert.equal(room.act(me, { op: 'serve', pizza: g.c.order }).ok, false, 'not before the order is hidden');
  run(room, clock, () => g.phase === 'build');
  for (const bad of [{ op: 'serve' }, { op: 'serve', pizza: 'cheese' }, { op: 'build', pizza: [1] }, { op: 'nope' }, {}, null]) assert.equal(room.act(me, bad).ok, false, JSON.stringify(bad));
  assert.equal(room.act(me, { op: 'build', pizza: { ...g.c.order, top: { ...g.c.order.top } } }).ok, true);
  assert.equal(room.act(me, { op: 'build', pizza: g.c.order, round: 99 }).ok, false, 'an old round');
  run(room, clock, () => g.phase === 'reveal');
  assert.equal(g.c.rows.find((x) => x.id === me.id).score, 100, 'an unserved draft still counts');
  const lz = g.c.rows.find((x) => x.id === lazy.id); assert.equal(lz.score, 0); assert.equal(lz.pizza, null);
  assert.equal(room.act(me, { op: 'serve', pizza: g.c.order }).ok, false, 'not after the reveal');
});
test('serving twice is ignored; everyone served ends the round early', () => {
  const { clock, room } = game({ mode: 'classic', rounds: 3, seconds: 60 }, 0);
  const a = room.join('Ana').player, b = room.join('Bo').player; a.sockets = b.sockets = 1; startGame(room); const g = room.game;
  run(room, clock, () => g.phase === 'build');
  const t0 = clock.now();
  assert(room.act(a, { op: 'serve', pizza: { crust: 'thin' } }).ok);
  assert.equal(room.act(a, { op: 'serve', pizza: g.c.order }).ok, false);
  assert(room.act(b, { op: 'serve', pizza: g.c.order }).ok);
  run(room, clock, () => g.phase === 'reveal');
  assert(clock.now() - t0 < 5000, 'revealed as soon as everyone served');
  assert.equal(g.c.rows[0].id, b.id);
});
test('disconnects: absent cooks do not hold up the kitchen; leavers drop out of results', () => {
  const { clock, room } = game({ mode: 'classic', rounds: 3, seconds: 60 }, 2);
  const a = room.join('Ana').player, b = room.join('Bo').player; a.sockets = 1; b.sockets = 1; startGame(room); const g = room.game;
  run(room, clock, () => g.phase === 'build');
  b.sockets = 0; // phone went to sleep
  room.act(a, { op: 'serve', pizza: g.c.order });
  const t0 = clock.now(); run(room, clock, () => g.phase === 'reveal');
  assert(clock.now() - t0 < g.c.buildMs, 'did not wait the whole clock for the absent cook');
  room.remove(b.id);
  run(room, clock);
  assert(!g.results().includes(b.id)); assert(g.results().includes(a.id));
});
test('a player joining mid-game can cook the next order; solo games work', () => {
  const { clock, room } = game({ mode: 'mixed', rounds: 3 }, 0);
  const a = room.join('Ana').player; a.sockets = 1; startGame(room); const g = room.game;
  run(room, clock, () => g.phase === 'build'); room.act(a, { op: 'serve', pizza: g.c.order.top ? g.c.order : {} });
  const late = room.join('Late').player; late.sockets = 1; g.joined(late);
  run(room, clock, () => g.round === 2 && g.phase === 'build');
  assert(room.act(late, { op: 'serve', pizza: g.c.order }).ok);
  run(room, clock); assert.deepEqual(g.results().sort(), [a.id, late.id].sort());
});
test('host skip moves through order → build → reveal → next', () => {
  const { room } = game({ mode: 'flash', rounds: 3 }, 3);
  startGame(room); const g = room.game;
  g.next(); assert.equal(g.phase, 'build'); g.next(); assert.equal(g.phase, 'reveal'); g.next(); assert.equal(g.phase, 'order'); assert.equal(g.round, 2);
  for (let i = 0; i < 6; i++) g.next(); assert.equal(g.phase, 'over'); assert.equal(g.results().length, 3);
});
test('orders: every kitchen × mode makes valid, varied orders with their words', () => {
  const { room } = game({ mode: 'classic' }, 3); startGame(room); const g = room.game;
  for (const k of KITCHEN_KEYS) for (const mode of Object.keys(MODES)) {
    const seen = new Set(), K = KITCHENS[k];
    for (let i = 0; i < 40; i++) {
      const o = g.makeOrder(mode, k);
      assert.equal(o.k, k);
      const c = clean(o, k);
      for (const r of K.rows) assert.equal(c[r.key], o[r.key], k + ' row ' + r.key);
      if (K.slots) { assert.deepEqual(c.top, o.top, k + ': an order is a clean dish'); const n = Object.keys(o.top).length; assert(n >= 1 && n <= 8, k + ' ' + mode + ' toppings ' + n); if (mode === 'flash' && K.at) assert(n >= 4); }
      if (K.stack) { assert.deepEqual(c.stack, o.stack); assert(o.stack.length >= 1 && o.stack.length <= K.maxStack); }
      if (k === 'burger') { assert(o.stack.includes('patty'), 'a burger has a patty'); if (mode === 'halves') assert(o.stack.length >= 7, 'a tower'); }
      if (k === 'sundae' && mode === 'halves') assert.equal(o.stack.length, 4, 'a mega sundae');
      if (mode === 'halves' && K.at) assert(o.sections.some((s) => s.kind !== 'whole'), k + ' sections');
      assert.equal(match(o, o), 100, k + ' an order matches itself');
      assert(o.words.length > 20 && o.words.length < 320, o.words);
      for (const x of [...Object.keys(o.top || {}), ...(o.stack || [])]) assert(o.words.includes(K.names[x].replace(/^a /, '')), k + ' words name ' + x + ': ' + o.words);
      seen.add(JSON.stringify([o.top, o.stack]));
    }
    assert(seen.size > 10, k + ' ' + mode + ' orders vary');
  }
});

test('every line every owner says in the game is in the intro’s story lists (so it is pre-voiced)', () => {
  const intro = require('fs').readFileSync(require('path').join(__dirname, '../public/box/intros/pizza.js'), 'utf8');
  for (const k of KITCHEN_KEYS) for (const v of Object.values(LINES[k])) for (const line of [].concat(v)) assert(intro.includes(`'${line.replace(/'/g, "\\'")}'`), k + ': missing from story: ' + line);
});

// ---------------- the other kitchens' scores ----------------
const dish = (k, o) => ({ k, ...o });
test('taco: the tacos can be in any order on the plate; which taco gets what still matters', () => {
  const o = dish('taco', { shell: 'corn', filling: 'pastor', salsa: 'verde', top: { onion: 7, cilantro: 7, pineapple: 1, lime: 6 } });
  assert.equal(match(o, o), 100);
  assert.equal(match(o, { ...o, top: { onion: 7, cilantro: 7, pineapple: 4, lime: 3 } }), 100, 'pineapple on another taco, same plate');
  const mixed = match(o, { ...o, top: { onion: 7, cilantro: 7, pineapple: 6, lime: 1 } });
  assert(mixed < 100 && mixed > 60, 'pineapple and lime swapped counts: ' + mixed);
  const bare = match(o, { shell: 'corn', filling: 'pastor', salsa: 'verde', top: {} });
  assert(bare < 35, 'no toppings ' + bare);
  assert.equal(match(o, { ...o, shell: 'flour' }), 92); assert.equal(match(o, { ...o, salsa: 'none' }), 90); assert.equal(match(o, { ...o, filling: 'beans' }), 88);
});
test('sushi: the board can be turned around, but the pieces keep their order', () => {
  const o = dish('sushi', { wrap: 'nori', rice: 'white', filling: 'salmon', top: { sesame: 0xff, roe: 0x0f, scallion: 0xf0, mayo: 0x55 } });
  assert.equal(match(o, o), 100);
  const turned = { ...o, top: { sesame: 0xff, roe: 0xf0, scallion: 0x0f, mayo: 0xaa } };
  assert.equal(match(o, turned), 100, 'the same board the other way round');
  const shifted = match(o, { ...o, top: { sesame: 0xff, roe: rot(0x0f, 2), scallion: rot(0xf0, 2), mayo: 0x55 } });
  assert(shifted < 100 && shifted > 50, 'rows shifted: ' + shifted);
  assert.equal(match(o, { ...o, filling: 'tuna' }), 85, 'the filling counts the most of the base');
});
test('burger: the order of the layers matters', () => {
  const o = dish('burger', { bun: 'sesame', stack: ['patty', 'cheese', 'lettuce', 'tomato', 'ketchup'] });
  assert.equal(match(o, o), 100);
  const swapped = match(o, { ...o, stack: ['patty', 'cheese', 'tomato', 'lettuce', 'ketchup'] });
  const reversed = match(o, { ...o, stack: o.stack.slice().reverse() });
  const missing = match(o, { ...o, stack: ['patty', 'cheese', 'lettuce', 'tomato'] });
  const other = match(o, { ...o, stack: ['egg', 'bacon', 'onion', 'pickle', 'mustard'] });
  assert(swapped < 100 && swapped > 85, 'two layers swapped ' + swapped);
  assert(reversed < swapped && reversed > 40, 'upside down ' + reversed);
  assert(missing < 100 && missing > reversed, 'a layer missing ' + missing);
  assert(other <= 12, 'nothing right but the bun ' + other);
  assert.equal(match(o, { ...o, bun: 'brioche' }), 88);
  assert.equal(match(o, { bun: 'sesame', stack: [] }), 12, 'just a bun');
});
test('sundae: scoop order matters, toppings are a set', () => {
  const o = dish('sundae', { vessel: 'cone', sauce: 'fudge', stack: ['vanilla', 'chocolate', 'strawberry'], top: { cherry: 1, sprinkles: 1 } });
  assert.equal(match(o, o), 100);
  const flipped = match(o, { ...o, stack: ['strawberry', 'chocolate', 'vanilla'] });
  assert(flipped < 100 && flipped > 60, 'scoops upside down ' + flipped);
  const noTop = match(o, { ...o, top: {} }), oneTop = match(o, { ...o, top: { cherry: 1 } }), extra = match(o, { ...o, top: { cherry: 1, sprinkles: 1, nuts: 1 } });
  assert(noTop < oneTop && oneTop < extra && extra < 100, [noTop, oneTop, extra].join(' < '));
});
test('every kitchen: deterministic, symmetric, 0..100, identical = 100 over random dishes', () => {
  let sd = 11; const r = () => { sd = (sd * 1103515245 + 12345) % 2147483648; return sd / 2147483648; };
  const pick = (a) => a[Math.floor(r() * a.length)];
  for (const k of KITCHEN_KEYS) {
    const K = KITCHENS[k];
    const rand = () => { const d = { k }; for (const row of K.rows) d[row.key] = pick(row.opts); if (K.slots) { d.top = {}; for (const x of K.tops) if (r() < 0.3) d.top[x] = 1 + Math.floor(r() * ((1 << K.slots) - 1)); } if (K.stack) d.stack = Array.from({ length: Math.floor(r() * (K.maxStack + 1)) }, () => pick(K.stack)); return d; };
    for (let i = 0; i < 200; i++) { const a = rand(), b = rand(), m = match(a, b); assert.equal(m, match(a, b)); assert.equal(m, match(b, a), k + ' symmetric'); assert(Number.isInteger(m) && m >= 0 && m <= 100); assert.equal(match(a, a), 100); }
  }
});
test('clean(): junk for every kitchen becomes a safe dish', () => {
  for (const k of KITCHEN_KEYS) {
    const K = KITCHENS[k];
    for (const bad of [null, undefined, 5, 'taco', [], true]) assert.equal(clean(bad, k), null);
    const c = clean({ shell: 'gold', wrap: {}, bun: '<b>', vessel: 9, top: { onion: 999, roe: -1, whip: 1.5, cherry: 1, lime: 1, sesame: 3, __proto__: { x: 1 } }, stack: ['patty', 'nope', 7, 'vanilla', ...Array(50).fill('cheese')], x: 'x'.repeat(1e5) }, k);
    for (const row of K.rows) assert(row.opts.includes(c[row.key]), k + ' ' + row.key);
    if (K.slots) for (const [x, m] of Object.entries(c.top)) { assert(K.tops.includes(x)); assert(m > 0 && m < (1 << K.slots)); }
    if (K.stack) { assert(c.stack.length <= K.maxStack); assert(c.stack.every((x) => K.stack.includes(x))); }
    assert(!('x' in c));
  }
  assert.deepEqual(clean({ stack: 'patty' }, 'burger'), { bun: 'sesame', stack: [] });
});

// ---------------- kitchens, the food court, Party Mode ----------------
test('a kitchen setting cooks there all game; Surprise me picks one per game; the intro knows it', () => {
  const seen = new Set();
  for (let seed = 1; seed < 40; seed++) {
    const { room } = game({ kitchen: 'surprise', rounds: 3 }, 3, (seed * 2654435761) >>> 0); startGame(room);
    const g = room.game; assert(KITCHENS[g.kitchen]); seen.add(g.kitchen);
    assert.equal(g.showExtra().kitchen, g.kitchen); assert.equal(g.tv().kitchen, g.kitchen); assert.equal(g.c.kitchen, g.kitchen);
  }
  assert.equal(seen.size, KITCHEN_KEYS.length, 'every kitchen comes up');
  const { room } = game({ kitchen: 'sushi', mode: 'halves', rounds: 3 }, 3); startGame(room);
  const t = room.game.tv(); assert.equal(t.kitchen, 'sushi'); assert.equal(t.c.modeName, 'Rainbow Roll');
  assert(CUSTOMERS.sushi.some((c) => c.id === t.c.customer.id), 'a sushi bar customer');
  assert.equal(room.game.nonna.who, 'sushi'); assert(Object.values(LINES.sushi).flat().includes(room.game.nonna.text), 'Chef Ren speaks');
});
test('food court: a different kitchen every order, all of them before any repeats', () => {
  const { clock, room } = game({ kitchen: 'court', mode: 'classic', rounds: 8 }, 3, 5); startGame(room);
  const g = room.game; assert.equal(g.showExtra().kitchen, 'court'); assert.equal(g.tv().court, true);
  const tvKitchens = [];
  run(room, clock, () => { if (g.phase === 'order' && tvKitchens[g.round - 1] == null) tvKitchens[g.round - 1] = g.tv().c.kitchen; return g.phase === 'over'; });
  const ks = g.history.map((h) => h.kitchen);
  assert.equal(ks.length, 8);
  assert.equal(new Set(ks.slice(0, 5)).size, 5, 'all five kitchens first: ' + ks);
  for (let i = 1; i < ks.length; i++) assert.notEqual(ks[i], ks[i - 1], 'never the same kitchen twice in a row: ' + ks);
  assert.deepEqual(tvKitchens, ks, 'the TV shows each order’s kitchen');
});
test('a served dish is cleaned for the order’s kitchen; a perfect one scores 100 in every kitchen', () => {
  for (const kitchen of KITCHEN_KEYS) {
    const { clock, room } = game({ kitchen, mode: 'classic', rounds: 1 }, 1);
    const me = room.join('Ana').player; me.sockets = 1; startGame(room); const g = room.game;
    run(room, clock, () => g.phase === 'build');
    assert.equal(room.act(me, { op: 'serve', dish: JSON.parse(JSON.stringify(g.c.order)) }).ok, true);
    run(room, clock, () => g.phase === 'reveal');
    assert.equal(g.c.rows.find((x) => x.id === me.id).score, 100, kitchen);
    assert.equal(g.view(me).c.order.k, kitchen); assert(!('sections' in g.view(me).c.order));
  }
});
test('Party Mode: partyFit is valid and leaves the kitchen a surprise', () => {
  const PF = require('../box/party-fit');
  for (const players of [1, 3, 8, 40]) for (const minutes of [5, 10, 20]) {
    const raw = def.partyFit({ players, minutes }), fit = PF.fitSettings(def, { players, minutes });
    assert.equal(raw.kitchen, 'surprise');
    for (const [k, v] of Object.entries(raw)) { const f = def.fields.find((x) => x.key === k); assert(f && f.options.some((o) => o.value === v), k + '=' + v); }
    assert.deepEqual(fit.settings, raw);
  }
  assert.equal(def.name, 'YesChef'); assert.equal(def.key, 'pizza'); assert.equal(def.defaults.kitchen, 'surprise');
});

console.log(`\n${passed} YesChef tests passed.`);

