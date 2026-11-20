'use strict';
// Pets (docs/justgold.md "Pets"): the `pet` look field, the 16 pets in the catalog, buying and
// wearing one at a time, carried into box rooms and JustMafia, and the animated drawing.
//   node tools/test-pets.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert/strict');
const O = require('../public/shared/options');
const C = require('../public/shared/cosmetics');
const SS = require('../public/shared/shop-season');
const { ProfileStore } = require('../profiles');
const { Room } = require('../game');
const { VirtualClock } = require('../clock');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };
const PETS = O.pets.filter((v) => v !== 'none');

test('16 pets: a `pet` look field (none is free), every pet in the catalog with a rarity, price and words', () => {
  assert.equal(O.AVATAR_FIELDS.pet, 'pets');
  assert.equal(O.pets[0], 'none');
  assert.equal(PETS.length, 16);
  const items = C.CATALOG.filter((i) => i.field === 'pet');
  assert.equal(items.length, 17);
  assert(items.find((i) => i.value === 'none').free);
  const rar = { common: 0, rare: 0, epic: 0, legendary: 0 };
  for (const i of items.filter((x) => x.value !== 'none')) {
    const info = C.PETS[i.value]; assert(info, i.id);
    assert(C.PET_RARITY[info.rarity], i.id); rar[info.rarity]++;
    assert(i.cost >= 50 && i.cost <= 600, `${i.id} costs ${i.cost}`);
    assert.equal(i.category, 'pets'); assert(i.special, 'never on the play-to-reveal shelf');
    assert.equal(i.description, info.desc); assert.notEqual(O.label(i.value), i.value, 'a real name');
  }
  assert.deepEqual(rar, { common: 4, rare: 6, epic: 4, legendary: 2 });
  // rarer is pricier
  const avg = (r) => { const l = items.filter((i) => (C.PETS[i.value] || {}).rarity === r); return l.reduce((s, i) => s + i.cost, 0) / l.length; };
  assert(avg('common') < avg('rare') && avg('rare') < avg('epic') && avg('epic') < avg('legendary'));
  assert(!C.STOCKABLE.some((i) => i.field === 'pet'), 'pets are not shelf stock');
  assert(!SS.POOL_ITEMS.some((i) => i.field === 'pet'), 'daily deals are unchanged');
  assert(C.CATEGORIES.some((c) => c.id === 'pets' && c.fields.includes('pet')));
});

test('buy and wear one pet at a time; an unowned pet never sticks to the look', () => {
  const w = new ProfileStore(null), a = w.create(); w.grant(a.id, 2000);
  w.select(a.id, { hair: 'long' });
  assert.equal(w.validateAvatar(a.id, { pet: 'fox' }).pet, 'none', 'not owned yet');
  assert.equal(w.equip(a.id, 'pet:fox').ok, false, 'buy first');
  const before = w.coins(a.id), r = w.buy(a.id, 'pet:fox'); assert(r.ok, r.error);
  assert.equal(w.coins(a.id), before - C.CATALOG.find((i) => i.id === 'pet:fox').cost);
  assert(w.equip(a.id, 'pet:fox').ok); assert.equal(w.lookOf(a.id).pet, 'fox');
  assert(w.buy(a.id, 'pet:dragonling').ok); assert(w.equip(a.id, 'pet:dragonling').ok);
  assert.equal(w.lookOf(a.id).pet, 'dragonling', 'the new pet replaces the old one');
  assert(w.equip(a.id, 'pet:dragonling', false).ok); assert.equal(w.lookOf(a.id).pet, 'none', 'take it off');
  assert(w.equip(a.id, 'pet:fox').ok);
  w.select(a.id, { color: '#e74c3c' }); assert.equal(w.lookOf(a.id).pet, 'fox', 'other changes keep the pet');
  w.select(a.id, { pet: 'owl' }); assert.equal(w.lookOf(a.id).pet, 'none', 'a look save cannot sneak in an unowned pet (like hats: back to none)');
  assert.equal(w.buy(a.id, 'pet:nonsense').ok, false);
  assert(w.equip(a.id, 'pet:fox').ok); assert(w.inventory(a.id).some((i) => i.id === 'pet:fox' && i.equipped));
});

test('JustMafia keeps a valid pet on the town character and drops junk', () => {
  const room = new Room('PETS', null, { clock: new VirtualClock(), seed: 3 });
  assert.equal(room.sanitizeAvatar({ pet: 'owl' }).pet, 'owl');
  assert.equal(room.sanitizeAvatar({ pet: 'tiger' }).pet, 'none');
  assert.equal(room.sanitizeAvatar({}).pet, 'none');
});

// ---- drawing: a counting canvas (every painted shape with its transform) ----
function canvas() {
  let m = [1, 0, 0, 1, 0, 0], n = 0, sig = []; const stack = [];
  const r = (v) => Math.round(v * 100) / 100, pt = (x, y) => `${r(m[0] * x + m[2] * y + m[4])},${r(m[1] * x + m[3] * y + m[5])}`;
  const mark = (...a) => { sig.push(a.join(' ')); };
  const grad = () => ({ addColorStop() {} });
  const ctx = {
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1, lineCap: 'butt', lineJoin: 'miter', shadowBlur: 0, shadowColor: '', font: '', imageSmoothingEnabled: true,
    save() { stack.push([m.slice(), ctx.globalAlpha]); }, restore() { [m, ctx.globalAlpha] = stack.pop(); },
    translate(x, y) { m = [m[0], m[1], m[2], m[3], m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; },
    scale(a, b) { m = [m[0] * a, m[1] * a, m[2] * b, m[3] * b, m[4], m[5]]; },
    rotate(a) { const c = Math.cos(a), s = Math.sin(a); m = [m[0] * c + m[2] * s, m[1] * c + m[3] * s, m[2] * c - m[0] * s, m[3] * c - m[1] * s, m[4], m[5]]; },
    beginPath() {}, closePath() {}, moveTo(x, y) { mark('M', pt(x, y)); }, lineTo(x, y) { mark('L', pt(x, y)); },
    quadraticCurveTo(a, b, x, y) { mark('Q', pt(a, b), pt(x, y)); }, bezierCurveTo(a, b, c, d, x, y) { mark('C', pt(x, y)); },
    arc(x, y, rad) { mark('A', pt(x, y), r(rad * m[0])); }, ellipse(x, y, rx, ry) { mark('E', pt(x, y), r(rx * m[0]), r(ry * m[3])); },
    rect(x, y) { mark('R', pt(x, y)); }, arcTo() {}, roundRect(x, y) { mark('R', pt(x, y)); },
    fill() { n++; }, stroke() { n++; }, clip() {}, fillRect(x, y) { n++; mark('FR', pt(x, y)); }, strokeRect() { n++; }, fillText() { n++; },
    createLinearGradient: grad, createRadialGradient: grad, drawImage() {}, measureText: () => ({ width: 0 }),
  };
  return { ctx, painted: () => n, sig: () => sig.join('|') };
}
const sandbox = { window: {}, console, Math };
vm.createContext(sandbox);
for (const f of ['shared/options.js', 'avatar.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8').replace("typeof window !== 'undefined' ? window : globalThis", 'window'), sandbox, { filename: f });
const A = sandbox.window.MTArt;

test('every pet draws (alone and on both bodies), and its idle loop moves and repeats every PET_LOOP seconds', () => {
  assert.deepEqual([...A.PET_KINDS].sort(), [...PETS].sort(), 'art for every pet in options.js');
  const L = A.PET_LOOP; assert(L > 0);
  for (const k of PETS) {
    const draw = (t) => { const c = canvas(); assert.equal(A.drawPet(c.ctx, 0, 0, k, { t, scale: 2 }), true); return c; };
    const a = draw(0.1); assert(a.painted() > 8, `${k} paints`);
    const frames = new Set([0.1, 0.5, 1.2, 1.67, 2.4, 2.9, 3.55].map((t) => draw(t).sig()));
    assert(frames.size >= 4, `${k} animates (${frames.size} distinct poses)`);
    assert.equal(draw(0.7).sig(), draw(0.7 + L).sig(), `${k} loops every ${L}s`);
    assert.equal(draw(2.25).sig(), draw(2.25 + 3 * L).sig(), `${k} loops`);
    for (const body of ['female', 'male']) {
      const without = canvas(), withPet = canvas();
      A.drawCharacter(without.ctx, 0, 0, { body, hair: 'short' }, { t: 1 });
      A.drawCharacter(withPet.ctx, 0, 0, { body, hair: 'short', pet: k }, { t: 1 });
      assert(withPet.painted() > without.painted() + 8, `${k} on the ${body} shoulder`);
      const dead = canvas(); A.drawCharacter(dead.ctx, 0, 0, { body, pet: k }, { dead: true }); const dead0 = canvas(); A.drawCharacter(dead0.ctx, 0, 0, { body }, { dead: true });
      assert.equal(dead.painted(), dead0.painted(), 'no pet on a fallen character');
    }
  }
  assert.equal(A.drawPet(canvas().ctx, 0, 0, 'none', {}), false);
  assert.equal(A.drawPet(canvas().ctx, 0, 0, 'tiger', {}), false);
  const still = (t) => { const c = canvas(); A.drawPet(c.ctx, 0, 0, 'kitten', { t, still: true }); return c.sig(); };
  assert.equal(still(0.3), still(2.6), 'still (reduced motion): one pose');
});

test('the pet sits on the screen-left shoulder, beside the head, for both bodies and every size', () => {
  // The chick's round body (its biggest ellipse) lands left of the head at shoulder height, and
  // scales with the character (feet at 100,200).
  for (const body of ['female', 'male']) for (const scale of [0.4, 1, 3]) {
    const c = canvas(), petOnly = canvas();
    A.drawCharacter(c.ctx, 100, 200, { body }, { scale, t: 1.9 });
    A.drawCharacter(petOnly.ctx, 100, 200, { body, pet: 'chick' }, { scale, t: 1.9 });
    const before = new Set(c.sig().split('|'));
    const es = petOnly.sig().split('|').filter((s) => s.startsWith('E ') && !before.has(s)).map((s) => s.split(' ').slice(1)).map(([p, rx, ry]) => [...p.split(',').map(Number), Number(rx), Number(ry)]);
    const big = es.sort((a, b) => b[2] * b[3] - a[2] * a[3])[0];
    assert(big, `${body} ×${scale}: pet shapes`);
    const [x, y] = big, dx = (x - 100) / scale, dy = (y - 200) / scale;
    assert(dx < -7 && dx > -22, `${body} ×${scale}: left shoulder (dx ${dx})`);
    assert(dy < -30 && dy > -45, `${body} ×${scale}: shoulder height (dy ${dy})`);
  }
});

console.log(`\nAll ${passed} pets checks passed.`);
