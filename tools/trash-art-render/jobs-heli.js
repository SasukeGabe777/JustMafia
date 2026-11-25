// JustZombies helipads, helicopter travel and flying rides: our own models (procModel in iso.js), the
// cartoon toon look with ink lines. The helicopters get a "fly" animation (8 frames per direction: the
// main rotor and the tail rotor turning, a little hover bob).
// node render.js jobs-heli.js <outDir>   then   node stage-v3.js <outDir> <public/box/games/trash-assets>
const base = require('./jobs.js');
const { PPM } = base;
const D5 = [0, 1, 2, 3, 4];
const TOON = { sat: 1.3, light: 1.05, ink: 0.03 };
const FLY = `const k = f / Math.max(1, an.frames), TAU = Math.PI * 2;
holder.traverse((o) => { if (o.name === 'rotor') { if (o.userData.ry == null) o.userData.ry = o.rotation.y; o.rotation.y = o.userData.ry + (an.name === 'fly' ? k * TAU / 4 : 0.35); }
  if (o.name === 'trotor') { if (o.userData.rx == null) o.userData.rx = o.rotation.x; o.rotation.x = o.userData.rx + (an.name === 'fly' ? k * TAU / 2 : 0); }
  if (o.name === 'body') { if (o.userData.py == null) o.userData.py = o.position.y; o.position.y = o.userData.py + (an.name === 'fly' ? Math.sin(k * TAU) * 0.05 : 0); } });`;
const jobs = [];
const H = (id, file, proc, o) => jobs.push({
  id, file,
  spec: { ppm: PPM, url: 'proc:' + proc, kind: 'proc', proc, length: o.len, cell: o.cell, anchor: o.anchor, dirs: o.dirs || D5, blob: o.blob === false ? undefined : [o.len * 0.3, 0.22], light: { shadowExtent: Math.max(5, o.len * 1.5) },
    quality: 0.86, outlinePx: 2, outlineColor: 'rgba(18,10,8,0.95)', toon: TOON, anims: o.anims || [{ name: 'static', frames: 1 }, { name: 'fly', frames: 8, fps: 24 }], onFrame: FLY, shadow: o.shadow },
  extra: { kind: o.kind || 'vehicle', name: o.name },
});
H('heli.rescue', 'props/heli-rescue.webp', 'heli', { len: 6.8, cell: [400, 320], anchor: [200, 200], blob: false, shadow: false, name: 'Rescue helicopter (helipad travel; our own model)' });
H('heli.gunship', 'props/heli-gunship.webp', 'gunship', { len: 6.8, cell: [400, 320], anchor: [200, 200], blob: false, shadow: false, name: 'Gunship (rare flying ride; our own model)' });
H('fly.jetpack', 'props/fly-jetpack.webp', 'jetpack', { len: 0.8, cell: [96, 96], anchor: [48, 70], anims: [{ name: 'static', frames: 1 }], blob: false, name: 'Jetpack (rare flying ride; our own model)' });
H('fly.glider', 'props/fly-glider.webp', 'glider', { len: 4.4, cell: [320, 260], anchor: [160, 190], anims: [{ name: 'static', frames: 1 }], blob: false, shadow: false, name: 'Hang-glider (rare flying ride; our own model)' });
H('heli.pad', 'props/heli-pad.webp', 'helipad', { len: 4.8, cell: [384, 240], anchor: [192, 120], dirs: [0], anims: [{ name: 'static', frames: 1 }], blob: false, kind: 'prop', name: 'Helipad (our own model)' });
module.exports = { roots: base.roots, jobs, PPM };
