// JustZombies final pass: re-render jobs on top of jobs.js.
//   - buildings in wider/taller cells (the first cells clipped their sides and front corner)
//   - vehicles get a "drive" animation (8 frames per direction: wheels/blades turning, a little body bob)
//   - our own ride-on mower model (proc:ridemower) and the push mower (proc:mower) as rideables
// node render.js jobs-v3.js <outDir> [filter]   then   node stage-v3.js <outDir> <public/box/games/trash-assets>
const base = require('./jobs.js');
const { PPM } = base;
const D5 = [0, 1, 2, 3, 4];
const jobs = [];
const pick = (id) => base.jobs.find((j) => j.id === id);
// buildings: cell = [width, height], anchor = footprint centre (a little left: shadows fall to the right)
const BIG = { cell: [736, 880], anchor: [360, 700] }, MID = { cell: [736, 660], anchor: [360, 490] };
const CELLS = {
  'bld.kk.a': BIG, 'bld.kk.b': BIG, 'bld.kk.c': BIG, 'bld.kk.d': BIG, 'bld.kk.e': BIG, 'bld.kk.f': BIG, 'bld.kk.g': BIG, 'bld.kk.h': BIG, 'bld.factory': BIG,
  'bld.crucible': MID, 'bld.house1': MID, 'bld.house2': MID, 'bld.house3': MID, 'bld.house4': MID, 'bld.garage': MID, 'bld.office': MID,
  'bld.warehouse': { cell: [816, 700], anchor: [400, 490] }, 'bld.shack': { cell: [480, 420], anchor: [232, 300] },
};
for (const [id, c] of Object.entries(CELLS)) { const j = pick(id); jobs.push({ ...j, spec: { ...j.spec, ...c } }); }
// vehicles: a static frame + "drive" (wheels turn, the body bobs, the cart rattles, mower blades spin)
const DRIVE = `if (an.name === 'drive') { const k = f / an.frames, TAU = Math.PI * 2;
  holder.traverse((o) => { if (/wheel/i.test(o.name)) { if (o.userData.rx == null) o.userData.rx = o.rotation.x; o.rotation.x = o.userData.rx - k * TAU; }
    if (/blade/i.test(o.name)) { if (o.userData.ry == null) o.userData.ry = o.rotation.y; o.rotation.y = o.userData.ry + k * TAU * 2; }
    if (/^body$/i.test(o.name) || /shopping-cart/i.test(o.name)) { if (o.userData.py == null) { o.userData.py = o.position.y; o.userData.rz = o.rotation.z; } o.position.y = o.userData.py + Math.abs(Math.sin(k * TAU * 2)) * 0.025; o.rotation.z = o.userData.rz + Math.sin(k * TAU) * 0.02; } });
} else holder.traverse((o) => { if (o.userData.rx != null) o.rotation.x = o.userData.rx; if (o.userData.ry != null) o.rotation.y = o.userData.ry; if (o.userData.py != null) { o.position.y = o.userData.py; o.rotation.z = o.userData.rz; } });`;
const ANIMS = [{ name: 'static', frames: 1 }, { name: 'drive', frames: 8, fps: 16 }];
const V = (id, file, url, o) => jobs.push({
  id, file,
  spec: { ppm: PPM, url, length: o.len, cell: o.cell, anchor: o.anchor, dirs: D5, blob: [o.len * 0.35, 0.25], tint: o.tint, matTint: o.matTint,
    light: { shadowExtent: Math.max(5, o.len * 1.5) }, quality: 0.85, yaw: o.yaw || 0, outlinePx: o.outlinePx, kind: o.kind, proc: o.proc, anims: ANIMS, onFrame: DRIVE },
  extra: { kind: 'vehicle', name: o.name },
});
const KN = (n) => `/x/kenney-car-kit/Models/GLB format/${n}.glb`;
V('vehicle.cart', 'props/vehicle-cart.webp', '/a/gd-kenney-market/Props/Shopping Cart.glb', { len: 1.0, cell: [128, 128], anchor: [64, 80], name: 'Shopping cart (rideable)' });
V('vehicle.mower', 'props/vehicle-mower.webp', 'proc:mower', { kind: 'proc', proc: 'mower', len: 1.2, cell: [128, 128], anchor: [64, 80], name: 'Push mower (rideable; our own model)' });
V('vehicle.ridemower', 'props/vehicle-ridemower.webp', 'proc:ridemower', { kind: 'proc', proc: 'ridemower', len: 1.9, cell: [176, 160], anchor: [88, 100], name: 'Ride-on mower (our own model)' });
V('vehicle.garbagetruck', 'props/vehicle-garbagetruck.webp', KN('garbage-truck'), { len: 6.0, cell: [384, 320], anchor: [192, 184], outlinePx: 2, tint: [0.95, 1.05, 0.9], name: 'Garbage truck (timed ram)' });
module.exports = { roots: base.roots, jobs, PPM };
