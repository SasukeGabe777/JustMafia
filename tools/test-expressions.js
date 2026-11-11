'use strict';
// Rasterizes the shared character renderer (the one the TV town, phones, Judge
// and cinematics all use) into a pixel grid and checks that every expression
// produces a visibly different face, for every hairstyle and hat.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert/strict');

function rasterContext() {
  const px = new Map();
  let tx = 0, ty = 0, sx = 1, sy = 1;
  const stack = [];
  const noop = () => {};
  const ctx = {
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1, shadowColor: '', shadowBlur: 0, imageSmoothingEnabled: true,
    save() { stack.push([tx, ty, sx, sy]); }, restore() { [tx, ty, sx, sy] = stack.pop(); },
    translate(x, y) { tx += x * sx; ty += y * sy; }, scale(a, b) { sx *= a; sy *= b; },
    fillRect(x, y, w, h) {
      for (let i = 0; i < Math.abs(w); i++) for (let j = 0; j < Math.abs(h); j++) px.set(`${Math.round(tx + (x + (w < 0 ? -i - 1 : i)) * sx)},${Math.round(ty + (y + (h < 0 ? -j - 1 : j)) * sy)}`, ctx.fillStyle);
    },
    rotate: noop, beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop, ellipse: noop, fill: noop, stroke: noop, strokeRect: noop, drawImage: noop,
  };
  return { ctx, frame: () => new Map(px) };
}
// Pixels that differ between two rendered frames (a missing pixel counts as different).
function diff(a, b) {
  let n = 0;
  for (const k of new Set([...a.keys(), ...b.keys()])) if (a.get(k) !== b.get(k)) n++;
  return n;
}
const MIN_VISIBLE = 6; // a 1-3px change is not a readable expression at town scale
function assertDistinct(frames, labels, what) {
  for (let i = 0; i < frames.length; i++) for (let j = i + 1; j < frames.length; j++) {
    const d = diff(frames[i], frames[j]);
    assert(d >= MIN_VISIBLE, `${labels[i]} vs ${labels[j]} differ by only ${d}px (${what})`);
  }
}

const sandbox = { window: {}, console, Math };
vm.createContext(sandbox);
for (const f of ['shared/options.js', 'avatar.js', 'character-art.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8').replace("typeof window !== 'undefined' ? window : globalThis", 'window'), sandbox, { filename: f });
}
const O = sandbox.window.MT_OPTIONS, A = sandbox.window.MTArt;
const draw = (avatar, opts = {}) => { const r = rasterContext(); A.drawCharacter(r.ctx, 0, 0, avatar, { t: 0, ...opts }); return r.frame(); };
const base = { color: '#3498db', skin: '#d9a273', hair: 'short', hairColor: '#241b18', eyes: '#416f91', outfit: 'traveler', features: 'none' };

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };

test('Every expression option has renderer art', () => {
  assert.deepEqual([...A.EXPRESSIONS].sort(), [...O.expression].sort());
});
test('Every expression looks different for every hairstyle (brows survive the fringe)', () => {
  for (const hair of O.hair) for (const hairColor of ['#241b18', '#e5c16e']) {
    assertDistinct(O.expression.map((expression) => draw({ ...base, hair, hairColor, expression })), O.expression, `${hair}/${hairColor}`);
  }
});
test('Every expression looks different under every hat and accessory', () => {
  // Full-face headwear (the Hood of Mercy, the Pumpkin Head) and the eye-covering masquerade
  // mask and agent shades hide the face/eyes by design; checked separately below.
  for (const hat of O.hats.filter((h) => !['executionerHood', 'pumpkin'].includes(h))) for (const accessory of O.accessory.filter((a) => !['mask', 'shades'].includes(a))) {
    assertDistinct(O.expression.map((expression) => draw({ ...base, hat, accessory, expression })), O.expression, `hat ${hat} / ${accessory}`);
  }
});
test('Full-face hoods hide the face (and its expression) completely', () => {
  const frames = O.expression.map((expression) => draw({ ...base, hat: 'executionerHood', expression }));
  for (const f of frames) assert.equal(diff(f, frames[0]), 0);
  assert(diff(frames[0], draw({ ...base, expression: 'smile' })) > 50, 'the hood visibly covers the head');
  assert(diff(draw({ ...base, hat: 'pumpkin', expression: 'smile' }), draw({ ...base, expression: 'smile' })) > 50, 'the Pumpkin Head covers the face');
  assert(diff(draw({ ...base, accessory: 'mask', expression: 'smile' }), draw({ ...base, expression: 'smile' })) > 20, 'the mask is visible over the eyes');
  assert(diff(draw({ ...base, accessory: 'shades', expression: 'smile' }), draw({ ...base, expression: 'smile' })) > 10, 'the shades are visible over the eyes');
});
test('Face markings are independent of expression', () => {
  const plain = draw({ ...base, expression: 'grin' });
  assert(diff(draw({ ...base, expression: 'grin', features: 'freckles' }), plain) >= 4);
  assert(diff(draw({ ...base, expression: 'grin', features: 'rosyCheeks' }), plain) >= 4);
});
test('Legacy features:"serious" still renders as Serious; unknown expressions fall back to Smile', () => {
  assert.equal(diff(draw({ ...base, features: 'serious' }), draw({ ...base, expression: 'serious', features: 'serious' })), 0);
  assert.equal(diff(draw({ ...base, expression: 'bogus' }), draw({ ...base, expression: 'smile' })), 0);
});
test('Animation states still override the chosen expression (scared reaction)', () => {
  const scared = O.expression.map((expression) => draw({ ...base, expression }, { scared: true }));
  for (const f of scared) assert.equal(diff(f, scared[0]), 0);
  for (const expression of O.expression) assert(diff(draw({ ...base, expression }), scared[0]) >= MIN_VISIBLE);
});
test('Expressions survive scaling to town size and ghost rendering', () => {
  assertDistinct(O.expression.map((expression) => draw({ ...base, expression }, { scale: 2 })), O.expression, 'scale 2');
  for (const expression of O.expression) { const r = rasterContext(); A.drawGhost(r.ctx, 0, 0, { ...base, expression }, { t: 0 }); }
});
console.log(`All ${passed} expression tests passed.`);
