'use strict';
// Rasterizes the shared character renderer (the one the TV town, phones, Judge
// and cinematics all use) into a pixel grid and checks that every expression
// produces a visibly different face, for every hairstyle and hat.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert/strict');

// The character is vector art (public/avatar.js drawSmooth), so a "frame" is the multiset of
// painted shapes: every fill/stroke/fillRect with its path, transform and style.
function rasterContext() {
  const shapes = new Map();
  let m = [1, 0, 0, 1, 0, 0], path = [];
  const stack = [];
  const r = (v) => Math.round(v * 10) / 10;
  const pt = (x, y) => `${r(m[0] * x + m[2] * y + m[4])},${r(m[1] * x + m[3] * y + m[5])}`;
  const style = (s) => (typeof s === 'string' ? s : 'gradient');
  const paint = (kind, s) => { const k = `${kind}|${style(s)}|${r(ctx.lineWidth)}|${path.join(' ')}`; shapes.set(k, (shapes.get(k) || 0) + 1); };
  const grad = () => ({ addColorStop() {} });
  const ctx = {
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1, shadowColor: '', shadowBlur: 0, imageSmoothingEnabled: true, lineCap: 'butt', lineJoin: 'miter', font: '', filter: 'none', globalCompositeOperation: 'source-over',
    save() { stack.push([m.slice(), ctx.fillStyle, ctx.strokeStyle, ctx.lineWidth, ctx.globalAlpha]); }, restore() { [m, ctx.fillStyle, ctx.strokeStyle, ctx.lineWidth, ctx.globalAlpha] = stack.pop(); },
    translate(x, y) { m = [m[0], m[1], m[2], m[3], m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; },
    scale(a, b) { m = [m[0] * a, m[1] * a, m[2] * b, m[3] * b, m[4], m[5]]; },
    rotate(a) { const c = Math.cos(a), s = Math.sin(a); m = [m[0] * c + m[2] * s, m[1] * c + m[3] * s, m[2] * c - m[0] * s, m[3] * c - m[1] * s, m[4], m[5]]; },
    beginPath() { path = []; }, closePath() { path.push('z'); },
    moveTo(x, y) { path.push('M' + pt(x, y)); }, lineTo(x, y) { path.push('L' + pt(x, y)); },
    quadraticCurveTo(a, b, x, y) { path.push('Q' + pt(a, b) + ' ' + pt(x, y)); }, bezierCurveTo(a, b, c, d, x, y) { path.push('C' + pt(a, b) + ' ' + pt(c, d) + ' ' + pt(x, y)); },
    arc(x, y, rad, a0, a1) { path.push(`A${pt(x, y)} ${r(rad)} ${r(a0)} ${r(a1)}`); }, ellipse(x, y, rx, ry, rot, a0, a1) { path.push(`E${pt(x, y)} ${r(rx)} ${r(ry)} ${r(rot)} ${r(a0)} ${r(a1)}`); },
    rect(x, y, w, h) { path.push(`R${pt(x, y)} ${r(w)} ${r(h)}`); }, arcTo() {}, roundRect(x, y, w, h) { path.push(`R${pt(x, y)} ${r(w)} ${r(h)}`); },
    fill() { paint('f', ctx.fillStyle); }, stroke() { paint('s', ctx.strokeStyle); }, clip() {},
    fillRect(x, y, w, h) { path = [`R${pt(x, y)} ${r(w)} ${r(h)}`]; paint('f', ctx.fillStyle); path = []; },
    strokeRect(x, y, w, h) { path = [`R${pt(x, y)} ${r(w)} ${r(h)}`]; paint('s', ctx.strokeStyle); path = []; },
    fillText(s, x, y) { path = [`T${s}${pt(x, y)}`]; paint('t', ctx.fillStyle); path = []; },
    createLinearGradient: grad, createRadialGradient: grad, drawImage() {}, measureText: () => ({ width: 0 }),
  };
  return { ctx, frame: () => new Map(shapes) };
}
// Shapes that differ between two rendered frames.
function diff(a, b) {
  let n = 0;
  for (const k of new Set([...a.keys(), ...b.keys()])) n += Math.abs((a.get(k) || 0) - (b.get(k) || 0));
  return n;
}
const MIN_VISIBLE = 2; // at least one shape replaced (eyes, brows or mouth)
function assertDistinct(frames, labels, what) {
  for (let i = 0; i < frames.length; i++) for (let j = i + 1; j < frames.length; j++) {
    const d = diff(frames[i], frames[j]);
    assert(d >= MIN_VISIBLE, `${labels[i]} vs ${labels[j]} differ by only ${d}px (${what})`);
  }
}

const sandbox = { window: {}, console, Math };
vm.createContext(sandbox);
for (const f of ['shared/options.js', 'avatar.js']) {
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
  assert(diff(frames[0], draw({ ...base, expression: 'smile' })) > 8, 'the hood visibly covers the head');
  assert(diff(draw({ ...base, hat: 'pumpkin', expression: 'smile' }), draw({ ...base, expression: 'smile' })) > 8, 'the Pumpkin Head covers the face');
  assert(diff(draw({ ...base, accessory: 'mask', expression: 'smile' }), draw({ ...base, expression: 'smile' })) > 2, 'the mask is visible over the eyes');
  assert(diff(draw({ ...base, accessory: 'shades', expression: 'smile' }), draw({ ...base, expression: 'smile' })) > 2, 'the shades are visible over the eyes');
});
test('Face markings are independent of expression', () => {
  const plain = draw({ ...base, expression: 'grin' });
  assert(diff(draw({ ...base, expression: 'grin', features: 'freckles' }), plain) >= 2);
  assert(diff(draw({ ...base, expression: 'grin', features: 'rosyCheeks' }), plain) >= 2);
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
