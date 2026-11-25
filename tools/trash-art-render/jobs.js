// Every sprite JustZombies needs, as render jobs for render.js / iso.js.
// World scale: PPM = 40*sqrt(2) px per metre, camera elevation 30 deg, yaw 45 deg -> 2:1 iso;
// one ground tile = 1.6 m square = 128 x 64 px diamond.
// Characters and vehicles render 5 directions (S, SE, E, NE, N); the game mirrors SW/W/NW from SE/E/NE.
// ASSET_ROOT = folder holding asset-dl/ (raw downloads) and asset-x/ (extracted Kenney/ambientCG packs).
const S = process.env.ASSET_ROOT || 'C:/Users/Cece/AppData/Local/Temp/claude/56822494e25c6090/81819607-7547-4d59-b6bb-89f853e2365a/scratchpad';
const PPM = 40 * Math.SQRT2;
const A = '/a/', X = '/x/';
const ZK = A + 'gd-zombie-kit/', TS = A + 'gd-toon-shooter/', KC = A + 'gd-kk-city/', QC = A + 'gd-q-chars/3D Animated Characters/', QM = A + 'gd-q-monsters/';
const KN = (kit, n) => `${X}kenney-${kit}/Models/GLB format/${n}.glb`, KG = (kit, n) => `${X}kenney-${kit}/Models/GLTF format/${n}.glb`;
const PP = (uuid) => `${A}pp-items/${uuid}.glb`; // poly.pizza downloads (Quaternius, CC0), named by their static.poly.pizza file id
const Z24 = A + 'pp-quaternius-zombie/c4002f69-6979-42e8-ad6e-2f4e14fc3a9d.glb'; // Quaternius "Zombie" (poly.pizza VlXjG0N8Eg)
const D5 = [0, 1, 2, 3, 4];
const BLOOD = { url: ZK + 'Prop/Blood 1.glb', length: 1.3, castShadow: false };
const GOO = [0.45, 1.6, 0.35], INK = [0.35, 0.2, 0.6];
const jobs = [];
const add = (id, file, spec, extra) => jobs.push({ id, file, spec: { ppm: PPM, ...spec }, extra });

// ---------------- zombies ----------------
const ZB = ZK + 'Zombie/Zombie Basic.glb', ZC = ZK + 'Zombie/Zombie Chubby.glb', ZR = ZK + 'Zombie/Zombie Ribcage.glb', ZA = ZK + 'Zombie/Zombie Arm.glb';
const ATT = { [ZB]: 'Idle_Attack', [ZC]: 'Idle_Attack', [ZA]: 'Punch', [ZR]: null, [Z24]: 'Idle_Attack' };
function zAnims(url, o = {}) {
  const a = [
    { name: 'idle', clip: 'Idle', frames: 6, fps: 6 },
    { name: 'walk', clip: o.walk || 'Walk', frames: 12, fps: o.walkFps || 12 },
  ];
  if (o.run) a.push({ name: 'run', clip: o.run === true ? 'Run' : o.run, frames: 10, fps: 15 });
  a.push(ATT[url] || o.attack ? { name: 'attack', clip: o.attack || ATT[url], frames: 10, fps: 14, loop: false } : { name: 'attack', clip: 'Jump', frames: 10, fps: 14, loop: false, to: 0.55 });
  a.push({ name: 'hit', clip: 'HitReact', frames: 5, fps: 16, loop: false });
  a.push({ name: 'death', clip: 'Death', frames: 16, fps: 14, loop: false, blood: 0.35 });
  return a;
}
const Z = (id, url, o = {}) => add('zombie.' + id, `sprites/zombie-${id}.webp`, {
  url, height: o.h || 1.8, cell: o.cell || [160, 160], anchor: o.anchor || [80, 104], blob: [0.35 * (o.h || 1.8) / 1.8, 0.3], dirs: D5,
  tint: o.tint, emissive: o.emissive, emissiveIntensity: o.ei, attach: o.attach, quality: 0.72, outlineColor: o.outline, outlinePx: o.outlinePx, matTint: o.matTint,
  blood: { ...BLOOD, length: 1.3 * (o.h || 1.8) / 1.8, tint: o.bloodTint }, anims: o.anims || zAnims(url, o),
}, { kind: 'character', type: id, name: o.name, look: o.look });

const CAN = PP('9586bdcb-a768-4915-a8c6-8de8e4b0a4c6'); // Quaternius Trashcan
Z('walker', ZB, { name: 'Shambler', look: 'base zombie' });
Z('runner', ZR, { name: 'Sprinter', run: true, tint: [1.05, 0.95, 0.85], look: 'ribcage zombie, run cycle' });
Z('crawler', ZB, { name: 'Crawler', tint: [0.85, 0.9, 0.8], look: 'legless crawl cycle', anims: [
  { name: 'idle', clip: 'Crawl', frames: 6, fps: 5 }, { name: 'walk', clip: 'Crawl', frames: 12, fps: 14 },
  { name: 'attack', clip: 'Crawl', frames: 10, fps: 18, loop: false }, { name: 'hit', clip: 'HitReact', frames: 5, fps: 16, loop: false },
  { name: 'death', clip: 'Death', frames: 16, fps: 14, loop: false, blood: 0.35 }] });
Z('bloater', ZC, { name: 'Bloater', h: 2.0, tint: [1.0, 1.05, 0.62], cell: [176, 176], anchor: [88, 116], bloodTint: [0.9, 1.3, 0.3], look: 'yellow fat zombie' });
Z('canhead', ZB, { name: 'Can-Head', tint: [0.9, 0.95, 1.0], look: 'trash can on its head', attach: [{ url: CAN, bone: 'Head', width: 0.56, pos: [0, 0.86, 0], rot: [180, 0, 0], tint: [2.2, 2.2, 2.3], castShadow: true }] });
Z('spitter', ZA, { name: 'Spitter', tint: [0.72, 1.12, 0.55], emissive: 0x1d3a00, ei: 0.25, bloodTint: GOO, look: 'green one-armed zombie' });
Z('exploder', ZC, { name: 'Gas-Bag', h: 1.9, tint: [1.2, 0.95, 0.5], emissive: 0x5a2a00, ei: 0.3, look: 'orange fat zombie with a gas can strapped on',
  attach: [{ url: TS + 'Prop/Gas Can.glb', bone: 'Torso', height: 0.45, pos: [0, 0.05, -0.32], rot: [0, 90, 0], castShadow: true }] });
Z('screamer', Z24, { name: 'Screamer', tint: [0.95, 0.82, 1.2], look: 'second zombie body, violet', attack: 'Idle_Attack' });
Z('stalker', ZR, { name: 'Stalker', run: true, tint: [0.55, 0.58, 0.7], look: 'dark ribcage zombie' });
Z('brute', ZC, { name: 'Raging Brute', h: 2.6, tint: [1.2, 0.72, 0.66], cell: [224, 224], anchor: [112, 150], attack: 'Punch', look: 'huge red zombie' });
Z('riot', ZB, { name: 'Riot Shield', tint: [0.8, 0.85, 0.95], look: 'carries a riot shield', attach: [{ url: 'proc:shield', bone: 'LowerArm.L', height: 0.95, pos: [0, -0.75, 0.28], rot: [0, 0, 0] }] });
Z('elite', ZB, { name: 'Glowing elite (any type can glow; this is the stock elite)', tint: [0.9, 1.08, 0.9], emissive: 0x1fbf50, ei: 0.22, outline: 'rgba(140,255,160,0.95)', outlinePx: 2, look: 'glowing green outline' });
Z('carrier', ZB, { name: 'Weapon carrier (drops the timed super weapon it holds)', tint: [1.15, 0.9, 0.72], look: 'holds a minigun', attack: 'Punch',
  attach: [{ url: 'proc:minigun', bone: 'Torso', length: 0.95, keepMetal: true, pos: [-0.32, -0.25, 0.45], rot: [0, -90, 0], castShadow: true }] });
// debuff zombies: own look so each reads differently (the game adds its aura on top)
Z('blinder', ZA, { name: 'Inkspitter', tint: [0.7, 0.55, 0.95], emissive: 0x1a0a30, ei: 0.3, bloodTint: INK, look: 'violet, inky blood' });
Z('webber', ZR, { name: 'Webber', tint: [1.35, 1.35, 1.35], look: 'pale white ribcage' });
Z('jammer', ZB, { name: 'Gunk Jammer', tint: [0.75, 0.78, 0.8], look: 'grey, a wrench through its head',
  attach: [{ url: A + 'gd-kk-rpgtools/Tool/Wrench A.glb', bone: 'Head', length: 0.34, pos: [0, 0.32, 0], rot: [0, 0, 70], castShadow: true }] });
Z('sludger', ZC, { name: 'Sludger', h: 1.9, tint: [0.65, 1.15, 0.4], emissive: 0x143a00, ei: 0.3, bloodTint: GOO, look: 'slimy green fat zombie' });
Z('squinter', Z24, { name: 'Squinter', tint: [1.3, 1.2, 0.55], emissive: 0x504000, ei: 0.35, look: 'yellow glow, second body' });
Z('confuser', ZA, { name: 'Spinner', tint: [1.0, 0.7, 1.25], look: 'pink one-armed zombie, traffic cone hat',
  attach: [{ url: ZK + 'Prop/Traffic Cone 1.glb', bone: 'Head', height: 0.35, pos: [0, 0.42, 0], castShadow: true }] });
Z('leecher', ZR, { name: 'Leech', run: true, tint: [1.25, 0.55, 0.5], look: 'blood-red ribcage' });
Z('shaker', ZC, { name: 'Stomper', h: 2.3, tint: [1.25, 0.85, 0.55], cell: [208, 208], anchor: [104, 140], attack: 'Punch', look: 'big orange stomper' });

// rot nest: a breathing trash mound (idle pulse, hit squash, death sink) - not a body, so its own job
add('zombie.nest', 'sprites/zombie-nest.webp', {
  url: TS + 'Prop/Debris Pile.glb', length: 2.4, tint: [0.75, 0.55, 0.8], emissive: 0x2a0a30, emissiveIntensity: 0.35, cell: [224, 192], anchor: [112, 124], dirs: [0], quality: 0.8,
  blood: { ...BLOOD, url: ZK + 'Prop/Blood 2.glb', length: 2.4, tint: GOO },
  onFrame: `const k = an.frames > 1 ? f / (an.frames - 1) : 0; holder.scale.set(1, 1, 1); holder.position.y = 0;
    if (an.name === 'idle') { const s = 1 + 0.06 * Math.sin(f / an.frames * Math.PI * 2); holder.scale.set(s, 2 - s, s); }
    if (an.name === 'hit') { const s = 1 - 0.12 * Math.sin(k * Math.PI); holder.scale.set(2 - s, s, 2 - s); }
    if (an.name === 'death') { holder.scale.set(1 + 0.15 * k, Math.max(0.05, 1 - 0.9 * k), 1 + 0.15 * k); }`,
  anims: [{ name: 'idle', frames: 10, fps: 8 }, { name: 'hit', frames: 5, fps: 14, loop: false }, { name: 'death', frames: 12, fps: 12, loop: false, blood: 0.2 }],
}, { kind: 'character', type: 'nest', name: 'Rot Nest', look: 'breathing purple trash mound' });

// ---------------- bosses ----------------
const bossAnims = (url, o = {}) => [
  { name: 'idle', clip: o.idle || 'Idle', frames: 6, fps: 6 }, { name: 'walk', clip: o.walk || 'Walk', frames: 10, fps: 10 },
  ATT[url] || o.attack ? { name: 'attack', clip: o.attack || ATT[url], frames: 10, fps: 12, loop: false } : { name: 'attack', clip: 'Jump', frames: 10, fps: 12, loop: false, to: 0.55 },
  { name: 'hit', clip: o.hit || 'HitReact', frames: 4, fps: 12, loop: false }, { name: 'death', clip: 'Death', frames: 14, fps: 10, loop: false, blood: 0.3 }];
const B = (id, url, o) => add('boss.' + id, `sprites/boss-${id}.webp`, {
  url, height: o.h, cell: o.cell || [256, 256], anchor: o.anchor || [128, 176], blob: [0.7, 0.35], dirs: D5, tint: o.tint, emissive: o.emissive, emissiveIntensity: o.ei, attach: o.attach, matTint: o.matTint,
  quality: 0.7, light: { shadowExtent: 8 }, outlinePx: 2, blood: { ...BLOOD, length: 2.6, tint: o.bloodTint }, anims: o.anims || bossAnims(url, o),
}, { kind: 'character', type: id, boss: true, name: o.name, look: o.look });
B('dumpster', ZC, { name: 'Dumpster Brute', h: 3.3, tint: [0.78, 0.9, 0.72], look: 'giant zombie with a dumpster on its back',
  attach: [{ url: KC + '3D City Builder/Dumpster.glb', bone: 'Torso', length: 1.4, pos: [0, -0.5, -0.75], rot: [0, 90, 0] }] });
B('spider', ZR, { name: 'Mother Webber', h: 2.2, tint: [1.35, 1.3, 1.35], look: 'huge pale crawler', anims: [
  { name: 'idle', clip: 'Crawl', frames: 6, fps: 5 }, { name: 'walk', clip: 'Crawl', frames: 10, fps: 12 }, { name: 'attack', clip: 'Jump', frames: 10, fps: 12, loop: false, to: 0.55 },
  { name: 'hit', clip: 'HitReact', frames: 4, fps: 12, loop: false }, { name: 'death', clip: 'Death', frames: 14, fps: 10, loop: false, blood: 0.3 }] });
B('foghorn', ZA, { name: 'The Foghorn', h: 3.1, tint: [1.15, 0.9, 0.62], look: 'giant with a traffic-cone horn',
  attach: [{ url: ZK + 'Prop/Traffic Cone 1.glb', bone: 'Head', height: 0.6, pos: [0, 0.35, 0.35], rot: [90, 0, 0], castShadow: true }] });
B('toxic', ZC, { name: 'Toxic Tub', h: 3.1, tint: [0.55, 1.2, 0.45], emissive: 0x1f5a00, ei: 0.35, bloodTint: GOO, look: 'green giant with a leaking barrel',
  attach: [{ url: TS + 'Prop/Exploding Barrel.glb', bone: 'Torso', height: 0.9, pos: [0, -0.3, -0.55], rot: [0, 0, 0], castShadow: true }] });
B('final', ZB, { name: 'Final boss (door boss fallback)', h: 3.5, tint: [1.25, 0.55, 0.55], emissive: 0x3a0000, ei: 0.3, look: 'huge red zombie' });
B('ratking', QM + 'Standing/Monkroose.glb', { name: 'The Rat Queen', h: 2.6, matTint: [['Monkroose_Main', '#8a7f78'], ['Monkroose_Secondary', '#d9a6a0']], attack: 'Punch', hit: 'HitReact', look: 'grey rodent queen with a crown',
  attach: [{ url: 'proc:crown', bone: 'Head', height: 0.34, pos: [0, 0.8, 0], castShadow: true }] });
B('sludge', QM + 'Blob/GreenBlob.glb', { name: 'Big Sludge', h: 2.4, tint: [0.75, 1.15, 0.55], emissive: 0x1f4a00, ei: 0.3, attack: 'Bite_Front', hit: 'HitRecieve', bloodTint: GOO, look: 'giant green slime' });
B('mascot', QM + 'Standing/Bunny.glb', { name: 'Grinny the Mascot', h: 2.9, tint: [1.15, 0.9, 0.75], attack: 'Punch', look: 'grimy mascot suit holding a giant hot dog',
  attach: [{ url: KN('food-kit', 'hot-dog'), bone: 'LowerArm.R', length: 0.9, pos: [0.1, -0.3, 0.4], rot: [0, 90, 0], castShadow: true }] });

// ---------------- survivors / NPCs ----------------
for (const [id, file] of [['lis', 'Characters Lis'], ['matt', 'Characters Matt'], ['sam', 'Characters Sam'], ['shaun', 'Characters Shaun']]) {
  add('survivor.' + id, `sprites/survivor-${id}.webp`, {
    url: ZK + 'Character/' + file + '.glb', height: 1.75, cell: [160, 160], anchor: [80, 104], blob: [0.33, 0.3], dirs: D5, quality: 0.72,
    blood: BLOOD, anims: [
      { name: 'idle', clip: 'Idle_Gun', frames: 6, fps: 6 }, { name: 'walk', clip: 'Walk_Gun', frames: 12, fps: 12 }, { name: 'run', clip: 'Run_Gun', frames: 10, fps: 14 },
      { name: 'wave', clip: 'Wave', frames: 10, fps: 10 }, { name: 'hit', clip: 'HitReact', frames: 5, fps: 16, loop: false },
      { name: 'death', clip: 'Death', frames: 14, fps: 12, loop: false, blood: 0.4 }],
  }, { kind: 'character', type: id, name: 'Survivor ' + id + ' (escort / hero)' });
}
const npcAnims = [{ name: 'idle', clip: 'Idle', frames: 6, fps: 6 }, { name: 'walk', clip: 'Walk', frames: 12, fps: 12 }, { name: 'wave', clip: 'Wave', frames: 10, fps: 10 },
  { name: 'interact', clip: 'Interact', frames: 10, fps: 12 }, { name: 'hit', clip: 'HitRecieve', frames: 5, fps: 16, loop: false }, { name: 'death', clip: 'Death', frames: 14, fps: 12, loop: false, blood: 0.4 }];
for (const [id, file, name] of [['tinker', 'Male Worker', 'Tinker (gun merchant rank 1)'], ['gunsmith', 'Swat', 'Gunsmith (rank 2)'], ['master', 'Male Suit', 'Master gunsmith (rank 3)'],
  ['grocer', 'Male Farmer', 'Market grocer'], ['quartermaster', 'Femal Worker', 'Surplus quartermaster'], ['trader', 'Femal Adventurer', 'Travelling trader']]) {
  add('npc.' + id, `sprites/npc-${id}.webp`, { url: QC + file + '.glb', height: 1.75, cell: [160, 160], anchor: [80, 104], blob: [0.33, 0.3], dirs: D5, quality: 0.72, blood: BLOOD, anims: npcAnims },
    { kind: 'character', type: id, name });
}
add('npc.medic', 'sprites/npc-medic.webp', { url: TS + 'Character/Character Hazmat.glb', height: 1.75, cell: [160, 160], anchor: [80, 104], blob: [0.33, 0.3], dirs: D5, quality: 0.72, blood: BLOOD,
  anims: [{ name: 'idle', clip: 'Idle', frames: 6, fps: 6 }, { name: 'walk', clip: 'Walk', frames: 12, fps: 12 }, { name: 'wave', clip: 'Wave', frames: 10, fps: 10 },
    { name: 'hit', clip: 'HitReact', frames: 5, fps: 16, loop: false }, { name: 'death', clip: 'Death', frames: 14, fps: 12, loop: false, blood: 0.4 }] }, { kind: 'character', type: 'medic', name: 'Clinic medic (hazmat)' });

// ---------------- vehicles (5 directions, 1 frame) ----------------
const V = (id, url, o) => add(id, `props/${id.replace(/\./g, '-')}.webp`, {
  url, length: o.len, cell: o.cell, anchor: o.anchor, dirs: D5, blob: o.blob || [o.len * 0.35, 0.25], tint: o.tint, attach: o.attach, matTint: o.matTint,
  light: { shadowExtent: Math.max(5, o.len * 1.5) }, quality: 0.85, yaw: o.yaw || 0, outlinePx: o.outlinePx, kind: o.kind, proc: o.proc,
}, { kind: o.boss ? 'vehicle-boss' : 'vehicle', boss: o.boss, name: o.name });
V('vehicle.cart', A + 'gd-kenney-market/Props/Shopping Cart.glb', { len: 1.0, cell: [112, 112], anchor: [56, 70], name: 'Shopping cart' });
V('vehicle.mower', 'proc:mower', { kind: 'proc', proc: 'mower', len: 1.2, cell: [128, 128], anchor: [64, 80], name: 'Lawnmower (procedural)' });
V('vehicle.ridemower', KN('car-kit', 'tractor'), { len: 1.9, cell: [144, 144], anchor: [72, 88], tint: [0.55, 1.1, 0.5], name: 'Ride-on mower (tractor model, tinted)' });
V('vehicle.garbagetruck', KN('car-kit', 'garbage-truck'), { len: 6.0, cell: [384, 320], anchor: [192, 184], outlinePx: 2, name: 'Garbage truck (timed ram + street prop)' });
V('vehicle.sedan', KN('car-kit', 'sedan'), { len: 4.4, cell: [288, 224], anchor: [144, 134], name: 'Sedan (car-alarm decoy car)' });
V('vehicle.trader', KN('car-kit', 'truck'), { len: 5.4, cell: [352, 288], anchor: [176, 170], name: 'Trader truck' });
V('vehicle.camper', ZK + 'Vehicle/Vehicle Truck.glb', { len: 5.4, cell: [352, 288], anchor: [176, 170], name: 'Survivor truck' });
V('vehicle.armored', ZK + 'Vehicle/Vehicle Pickup Armored.glb', { len: 5.0, cell: [320, 256], anchor: [160, 152], name: 'Armored pickup' });
V('boss.truck', A + 'gd-kenney-cars/3D Cars/Garbage Truck.glb', { len: 7.0, cell: [448, 384], anchor: [224, 220], outlinePx: 2, tint: [0.7, 0.85, 0.65], boss: true, name: 'Garbage Truck Titan',
  attach: [{ url: TS + 'Wall/Barrier Trash.glb', length: 2.6, pos: [0, 0, 3.4], castShadow: true }] });
V('boss.icecream', KN('car-kit', 'delivery'), { len: 5.2, cell: [352, 352], anchor: [176, 214], outlinePx: 2, tint: [1.15, 0.92, 1.05], boss: true, name: 'Ice-cream-truck boss',
  attach: [{ url: KN('food-kit', 'ice-cream'), height: 1.4, pos: [0, 2.4, 0.6], castShadow: true }] });
V('boss.compactor', KN('car-kit', 'garbage-truck'), { len: 7.2, cell: [448, 384], anchor: [224, 220], outlinePx: 2, tint: [1.45, 0.72, 0.42], boss: true, name: 'Garbage-compactor boss' });
V('turret', PP('58ce64fc-b698-4b78-af75-05bb2dfad2ed'), { len: 1.1, cell: [128, 128], anchor: [64, 84], name: 'Turret (5 aim directions; Garage Defense buildable)' });

// ---------------- props (static, 1-2 views) ----------------
const P = (id, url, o = {}) => add('prop.' + id, `props/prop-${id}.webp`, {
  url, height: o.h, length: o.len, width: o.w, cell: o.cell || [128, 128], anchor: o.anchor || [64, 92], dirs: o.dirs || [0], yaw: o.yaw || 0,
  blob: o.blob, tint: o.tint, matTint: o.matTint, quality: 0.85, light: o.light, kind: url.startsWith('proc:') ? 'proc' : undefined, proc: url.startsWith('proc:') ? url.slice(5) : undefined,
}, { kind: 'prop', name: o.name, foot: o.foot });
const car = { dirs: [1, 3], cell: [288, 224], anchor: [144, 134] };
P('car', KN('car-kit', 'sedan'), { len: 4.4, ...car });
P('car2', KN('car-kit', 'hatchback-sports'), { len: 4.0, ...car });
P('car3', KN('car-kit', 'suv'), { len: 4.6, ...car });
P('police', KN('car-kit', 'police'), { len: 4.4, ...car });
P('taxi', KN('car-kit', 'taxi'), { len: 4.4, ...car });
P('van', KN('car-kit', 'van'), { len: 4.8, ...car });
P('ambulance', KN('car-kit', 'ambulance'), { len: 5.2, dirs: [1, 3], cell: [352, 288], anchor: [176, 170] });
P('bus', KN('car-kit', 'delivery'), { len: 5.6, dirs: [1, 3], cell: [352, 288], anchor: [176, 170], name: 'Delivery van (stands in for bus)' });
P('wreck', TS + 'Prop/Debris Broken Car.glb', { len: 4.2, ...car, name: 'Wrecked car' });
P('wreck.burnt', KN('car-kit', 'sedan'), { len: 4.4, ...car, tint: [0.36, 0.33, 0.31], name: 'Burnt-out car' });
P('wreck.suv', KN('car-kit', 'suv'), { len: 4.6, ...car, tint: [0.5, 0.42, 0.36], name: 'Rusted SUV wreck' });
P('wreck2', ZK + 'Vehicle/Vehicle Pickup Armored.glb', { len: 5.0, dirs: [1, 3], cell: [320, 256], anchor: [160, 152] });
P('container', ZK + 'Prop/Container Red.glb', { len: 4.8, dirs: [1, 3], cell: [320, 256], anchor: [160, 160] });
P('container2', ZK + 'Prop/Container Green.glb', { len: 4.8, dirs: [1, 3], cell: [320, 256], anchor: [160, 160] });
P('tires', ZK + 'Prop/Wheels Stack.glb', { h: 0.9 });
P('tirepile', TS + 'Prop/Debris Tires.glb', { len: 1.6, dirs: [1, 3] });
P('trash', TS + 'Prop/Debris Pile.glb', { len: 1.6 });
P('bags', ZK + 'Prop/Trash Bag 1.glb', { h: 0.7 });
P('bags2', ZK + 'Prop/Trash Bag 2.glb', { h: 0.7 });
P('barrel', ZK + 'Prop/Barrel.glb', { h: 1.0 });
P('barrel.explosive', TS + 'Prop/Exploding Barrel.glb', { h: 1.0 });
P('barrel.spilled', TS + 'Prop/Exploding Barrel Spilled.glb', { len: 1.6, dirs: [1] });
P('barrel.rusty', A + 'gd-kk-resource/Fuel/Fuel A Barrel Dirty.glb', { h: 1.0 });
P('fridge', KG('furniture-kit', 'kitchenFridge'), { h: 1.8, dirs: [1, 3], cell: [128, 160], anchor: [64, 124] });
P('bin', CAN, { h: 1.0, name: 'Trash can' });
P('bin2', PP('ed8a9b54-8d2c-4e2b-a78f-9c2646d4ea63'), { h: 1.2, name: 'Trash can (large wheelie bin)' });
P('bin3', PP('2e578103-ce2b-4b31-af0b-af507a52ebc2'), { h: 0.7, cell: [96, 112], anchor: [48, 84], name: 'Trash can (small)' });
P('hedge', A + 'gd-q-nature/Bush/Bush Common Flowers.glb', { len: 1.9 });
P('pot', KC + '3D City Builder/Bush.glb', { h: 0.9, name: 'Potted bush' });
P('bush', KN('retro-urban-kit', 'tree-shrub'), { h: 0.9 });
P('tree', A + 'gd-q-nature/Tree/Common Tree 1.glb', { h: 5.0, cell: [224, 288], anchor: [112, 256], light: { shadowExtent: 8 } });
P('tree2', A + 'gd-q-nature/Tree/Common Tree 3.glb', { h: 4.6, cell: [224, 288], anchor: [112, 256], light: { shadowExtent: 8 } });
P('tree.dead', A + 'gd-q-nature/Tree/Dead Tree 1.glb', { h: 4.2, cell: [224, 288], anchor: [112, 256], light: { shadowExtent: 8 } });
P('pine', A + 'gd-q-nature/Tree/Pine 1.glb', { h: 5.2, cell: [192, 288], anchor: [96, 260], light: { shadowExtent: 8 } });
P('cart', A + 'gd-kenney-market/Props/Shopping Cart.glb', { len: 1.0, dirs: [1, 3], cell: [112, 112], anchor: [56, 70] });
P('barrier', ZK + 'Prop/Plastic Barrier.glb', { len: 1.8, dirs: [1, 3] });
P('barrier.concrete', ZK + 'Prop/Traffic Barrier 1.glb', { len: 2.2, dirs: [1, 3], cell: [176, 144], anchor: [88, 96] });
P('barrier.striped', ZK + 'Prop/Traffic Barrier 2.glb', { len: 2.2, dirs: [1, 3], cell: [176, 144], anchor: [88, 96] });
P('barricade', TS + 'Wall/Barrier Large.glb', { len: 2.4, dirs: [1, 3], cell: [192, 176], anchor: [96, 116], name: 'Garage Defense barricade' });
P('barricade.wood', TS + 'Wall/Barrier Single.glb', { len: 1.6, dirs: [1, 3], name: 'Barricade (small)' });
P('barricade.trash', TS + 'Wall/Barrier Trash.glb', { len: 2.2, dirs: [1, 3], cell: [192, 176], anchor: [96, 116] });
P('sandbags', TS + 'Wall/Sack Trench.glb', { len: 2.4, dirs: [1, 3], cell: [192, 160], anchor: [96, 104] });
P('fence', TS + 'Wall/Fence.glb', { len: 1.6, dirs: [1, 3], cell: [160, 160], anchor: [80, 108] });
P('fence.metal', TS + 'Wall/Metal Fence.glb', { len: 1.6, dirs: [1, 3], cell: [160, 160], anchor: [80, 108] });
P('fence.picket', KN('city-kit-suburban', 'fence-1x2'), { len: 3.2, dirs: [1, 3], cell: [224, 176], anchor: [112, 112] });
P('crate', TS + 'Prop/Crate.glb', { h: 0.8 });
P('boxes', TS + 'Prop/Cardboard Boxes 1.glb', { len: 1.2 });
P('boxes2', TS + 'Prop/Cardboard Boxes 3.glb', { len: 1.2 });
P('pallet', ZK + 'Prop/Pallet.glb', { len: 1.2, dirs: [1] });
P('planks', TS + 'Prop/Wood Planks.glb', { len: 1.6, dirs: [1] });
P('cinderblock', ZK + 'Prop/Cinder Block.glb', { len: 0.5, cell: [96, 96], anchor: [48, 64] });
P('dumpster', KC + '3D City Builder/Dumpster.glb', { len: 2.0, dirs: [1, 3], cell: [160, 160], anchor: [80, 104] });
P('dumpster.open', TS + 'Prop/Trash Container Open.glb', { len: 2.0, dirs: [1, 3], cell: [160, 160], anchor: [80, 104] });
P('bench', KC + '3D City Builder/Bench.glb', { len: 1.8, dirs: [1, 3] });
P('planter', KN('city-kit-suburban', 'planter'), { len: 1.0 });
P('tank', TS + 'Prop/Gas Tank.glb', { len: 3.0, dirs: [1, 3], cell: [224, 192], anchor: [112, 128] });
P('pipe', ZK + 'Prop/Pipes.glb', { len: 3.6, dirs: [1, 3], cell: [256, 176], anchor: [128, 112] });
P('lamp', ZK + 'Prop/Street Lights.glb', { h: 4.2, cell: [144, 256], anchor: [72, 228], dirs: [1, 3], light: { shadowExtent: 8 } });
P('lamp2', KC + '3D City Builder/Streetlight.glb', { h: 4.0, cell: [144, 256], anchor: [72, 228], dirs: [1, 3], light: { shadowExtent: 8 } });
P('hydrant', ZK + 'Prop/Fire Hydrant.glb', { h: 0.8, cell: [96, 112], anchor: [48, 84] });
P('cone', ZK + 'Prop/Traffic Cone 1.glb', { h: 0.7, cell: [96, 112], anchor: [48, 84] });
P('trafficlight', ZK + 'Prop/Traffic Light 1.glb', { h: 4.2, cell: [176, 256], anchor: [88, 228], dirs: [1, 3], light: { shadowExtent: 8 } });
P('couch', ZK + 'Fourniture/Couch.glb', { len: 2.0, dirs: [1, 3], cell: [176, 160], anchor: [88, 104] });
P('sign', TS + 'Prop/Sign.glb', { h: 1.6, dirs: [1, 3], cell: [128, 160], anchor: [64, 128] });
P('townsign', ZK + 'Prop/Town Sign.glb', { h: 2.4, dirs: [1, 3], cell: [176, 208], anchor: [88, 172] });
P('watertower', ZK + 'Building/Water Tower.glb', { h: 9, cell: [288, 480], anchor: [144, 420], light: { shadowExtent: 12 } });
P('gascan', TS + 'Prop/Gas Can.glb', { h: 0.5, cell: [96, 96], anchor: [48, 64] });
P('papers', TS + 'Prop/Debris Papers 1.glb', { len: 1.2, cell: [128, 96], anchor: [64, 56] });
P('blood1', ZK + 'Prop/Blood 1.glb', { len: 1.4, cell: [128, 96], anchor: [64, 48] });
P('blood2', ZK + 'Prop/Blood 2.glb', { len: 1.4, cell: [128, 96], anchor: [64, 48] });
P('blood3', ZK + 'Prop/Blood 3.glb', { len: 1.4, cell: [128, 96], anchor: [64, 48] });
P('mound', TS + 'Prop/Debris Pile.glb', { len: 3.0, cell: [224, 176], anchor: [112, 112] });
P('spikes', 'proc:spikes', { len: 1.4, dirs: [1, 3], cell: [128, 96], anchor: [64, 56], name: 'Spike strip (Garage Defense; procedural)' });
P('sprinkler', 'proc:sprinkler', { len: 0.8, cell: [96, 96], anchor: [48, 64], name: 'Sprinkler-flamer (Garage Defense; procedural)' });
P('alarm', 'proc:beacon', { len: 0.45, cell: [96, 96], anchor: [48, 64], name: 'Car-alarm decoy beacon (Garage Defense; procedural)' });
P('beartrap', TS + 'Weapon/Bear Trap Open.glb', { len: 0.7, cell: [96, 96], anchor: [48, 60] });
P('landmine', TS + 'Weapon/Landmine.glb', { len: 0.45, cell: [96, 96], anchor: [48, 60] });

// garage door: closed / opening (roll-up) / open
add('garage.door', 'props/garage-door.webp', {
  kind: 'proc', proc: 'garagedoor', width: 2.9, cell: [224, 224], anchor: [112, 150], dirs: [1, 3], quality: 0.85, light: { shadowExtent: 6 },
  onFrame: `const d = holder.getObjectByName('DOOR'); if (d) { const k = an.name === 'closed' ? 0 : an.name === 'open' ? 1 : (an.frames > 1 ? f / (an.frames - 1) : 1); const e = 1 - Math.pow(1 - k, 2); d.scale.y = Math.max(0.04, 1 - e); d.position.y = 2.4 * e; }`,
  anims: [{ name: 'closed', frames: 1 }, { name: 'opening', frames: 10, fps: 12, loop: false }, { name: 'open', frames: 1 }],
}, { kind: 'prop', name: 'Garage door (Garage Defense)' });

// chest: closed / opening / open (+ special key chest)
for (const [id, url] of [['chest', ZK + 'Prop/Chest.glb'], ['chest.key', ZK + 'Prop/Chest Special.glb']]) {
  add(id, `props/${id.replace('.', '-')}.webp`, {
    kind: 'chest', url, lidFrom: 0.62, length: 1.1, cell: [128, 128], anchor: [64, 92], dirs: [0], blob: [0.5, 0.3], quality: 0.9,
    anims: [{ name: 'closed', frames: 1, lid: 0 }, { name: 'opening', frames: 10, fps: 18, lid: 105, loop: false }, { name: 'open', frames: 1, lid: 105 }],
  }, { kind: 'chest' });
}

// ---------------- buildings (2 facings) ----------------
const BLD = (id, url, o) => add('bld.' + id, `props/bld-${id}.webp`, {
  url, width: o.w, length: o.len, height: o.h, cell: o.cell, anchor: o.anchor, dirs: o.dirs || [0, 2], yaw: o.yaw ?? -45, tint: o.tint, quality: 0.85,
  light: { shadowExtent: 16 }, outlinePx: 2, attach: o.attach,
}, { kind: 'building', name: o.name, use: o.use });
const BC = (n) => KN('city-kit-commercial', n), BSU = (n) => KN('city-kit-suburban', n), BI = (n) => KN('city-kit-industrial', n);
const bCell = { cell: [448, 560], anchor: [224, 456] };
BLD('tower', BC('building-skyscraper-a'), { len: 9, cell: [448, 896], anchor: [224, 800] });
BLD('crucible', BI('building-a'), { len: 9.5, ...bCell, use: 'Scrapyard crucible' });
BLD('warehouse', BI('building-c'), { len: 9.5, ...bCell });
BLD('factory', BI('building-f'), { len: 9.5, ...bCell });
BLD('house1', BSU('building-type-a'), { len: 8, ...bCell });
BLD('house2', BSU('building-type-c'), { len: 8, ...bCell });
BLD('house3', BSU('building-type-h'), { len: 8, ...bCell });
BLD('house4', BSU('building-type-m'), { len: 8, ...bCell });
BLD('garage', BSU('building-type-q'), { len: 7, ...bCell, use: 'Garage (Garage Defense base)' });
BLD('shack', TS + 'Building/Structure 1.glb', { len: 6, cell: [352, 352], anchor: [176, 272] });
// town shops are KayKit city buildings (colourful storefronts); the manifest maps market/surplus/clinic/gun1-3/shop1-3 onto these
for (const L of 'ABCDEFGH') BLD('kk.' + L.toLowerCase(), KC + 'Building/Building ' + L + '.glb', { len: 7, ...bCell });
BLD('office', BC('building-c'), { len: 8, ...bCell });

// ---------------- pickups + weapons (8-frame spin, 2x scale for readability) ----------------
const PU = (id, url, o = {}) => add((o.prefix || 'pickup.') + id, `pickups/${(o.prefix || 'pickup.').replace('.', '-')}${id.replace(/\./g, '-')}.webp`, {
  url, kind: url.startsWith('proc:') ? 'proc' : undefined, proc: url.startsWith('proc:') ? url.slice(5) : undefined,
  height: o.h, length: o.len, ppm: PPM * 2, cell: [96, 96], anchor: [48, 72], blob: [0.22, 0.4], dirs: [0], tint: o.tint, quality: 0.85, keepMetal: true,
  emissive: o.emissive, emissiveIntensity: o.ei, opacity: o.opacity, rot: o.rot,
  anims: [{ name: 'spin', frames: 8, fps: 10, spin: true }], light: { shadowExtent: 2 },
}, { kind: o.prefix === 'weapon.' ? 'weapon' : 'pickup', name: o.name, scaleHint: 0.5 });
PU('shield', 'proc:bubble', { h: 0.55, name: 'Bubble Shield' });
PU('armor', PP('60ccfcdb-6aa7-4caf-a688-9b16a2a5f300'), { h: 0.55, name: 'Trash-Can Armor (metal armour)' });
PU('minigun', 'proc:minigun', { len: 0.7, name: 'Buzzsaw Minigun (timed)' });
PU('rockets', PP('4b445cbf-38b6-43f3-afd6-32d88e8f074b'), { len: 0.8, name: 'Rocket Barrage (timed)' });
PU('raygun', 'proc:raygun', { len: 0.5, name: 'Ray Gun (timed)' });
PU('truck', KN('car-kit', 'garbage-truck'), { len: 0.75, name: 'Garbage-Truck Ram (timed)' });
PU('kicks', 'proc:kicks', { len: 0.42, name: 'Rocket Sneakers (procedural)' });
PU('nuke', PP('9d3bebc0-0b3d-4d7e-b860-a596d558f304'), { h: 0.5, name: 'Garbage Day (bomb)' });
PU('freeze', PP('c3b986f2-25e8-44c8-82dc-e553aea6ae5f'), { h: 0.45, name: 'Freezer Burn (ice block)' });
PU('snack', PP('902137fb-744d-4481-b793-18fe904a5edf'), { len: 0.45, name: 'Health Snack (hot dog)' });
PU('xp2', PP('a892170f-459a-4d1f-814a-76cfd4fafcbc'), { h: 0.5, name: 'Double XP (star coin)' });
PU('scope', 'proc:fov', { len: 0.4, name: 'Lookout Binoculars (FOV boost; procedural)' });
PU('cash', 'proc:cash', { len: 0.45, name: 'Cash (bill stacks; procedural)' });
PU('cash.bag', PP('2ccec256-4c6e-4179-8668-3c72721ddeb9'), { h: 0.45, name: 'Cash bag' });
PU('coins', PP('af8eccc6-bc94-4a31-a4dd-a2d2a1755735'), { len: 0.45, name: 'Coin pile' });
PU('xp', PP('60566587-6940-4642-9feb-44a023791fda'), { h: 0.4, name: 'XP gem (blue)' });
PU('xp.green', PP('975e55e6-5400-4fd1-97a1-6deaebb19c1a'), { h: 0.4, name: 'XP gem (green, bigger value)' });
PU('xp.pink', PP('97fcdb07-9d4d-46f2-8c17-392bb61915e6'), { h: 0.4, name: 'XP gem (pink, biggest value)' });
PU('health', TS + 'Collectable/Health.glb', { len: 0.55, name: 'Health / medkit' });
PU('heart', PP('38716c7c-cd82-4254-8cce-51a6c2491e8a'), { h: 0.45, name: 'Heart' });
PU('core', PP('f2bbae6a-f84c-493e-8a39-7498e90fbd49'), { h: 0.6, tint: [1.2, 0.5, 0.6], emissive: 0x6a0010, ei: 0.5, name: 'Boss core (crucible core)' });
PU('core.cage', 'proc:core', { h: 0.55, name: 'Boss core (caged; procedural alt)' });
PU('map', A + 'gd-kk-rpgtools/Prop/Map Rolled.glb', { len: 0.6, name: 'Map piece' });
PU('ammo', PP('d77c65f0-1e08-4085-a31d-2fed73d51315'), { len: 0.5, name: 'Ammo (bullets)' });
PU('ammo.crate', X + 'kenney-blaster-kit/Models/GLB format/crate-medium.glb', { len: 0.55, tint: [0.75, 0.85, 0.55], name: 'Ammo crate' });
PU('keypiece', 'proc:keypiece', { h: 0.45, name: 'Key piece (procedural)' });
PU('key', TS + 'Collectable/Key.glb', { len: 0.55, name: 'Whole key' });
PU('bomb', TS + 'Weapon/Grenade.glb', { h: 0.4, name: 'Bomb charge' });
PU('food', KN('food-kit', 'burger'), { len: 0.4, name: 'Food' });
PU('soda', KN('food-kit', 'soda-can'), { h: 0.4, name: 'Soda' });
PU('battery', PP('efd35cc3-a593-4482-a0c4-dc495eadabf0'), { h: 0.4, name: 'Battery' });
PU('turretkit', PP('58ce64fc-b698-4b78-af75-05bb2dfad2ed'), { len: 0.55, name: 'Turret kit' });
// weapons (13 game weapons; same 2x spin atlas, also used as shop/hand art)
const W = (id, url, o = {}) => PU(id, url, { ...o, prefix: 'weapon.' });
W('pistol', TS + 'Weapon/Pistol.glb', { len: 0.5, name: 'Pipe Blaster (pistol)' });
W('shotgun', TS + 'Weapon/Shotgun.glb', { len: 0.8, name: 'Scrap Scattergun (shotgun)' });
W('smg', TS + 'Weapon/SMG.glb', { len: 0.6, name: 'Pocket Rattler (SMG)' });
W('nailgun', X + 'kenney-blaster-kit/Models/GLB format/blaster-d.glb', { len: 0.55, tint: [1.2, 1.0, 0.55], name: 'Nail Gun' });
W('bat', ZK + 'Weapon/Wooden Bat Barbed.glb', { len: 0.8, name: 'Nail Bat' });
W('crossbow', A + 'gd-kk-skeletons/Weapon/Skeleton Crossbow.glb', { len: 0.7, name: 'Fence-Post Crossbow' });
W('flamer', 'proc:flamer', { len: 0.7, name: 'Hairspray Torch (flamethrower; procedural)' });
W('blower', 'proc:blower', { len: 0.7, name: 'Leaf Blower (procedural)' });
W('hubcap', KN('car-kit', 'wheel-default'), { len: 0.45, name: 'Boomerang Hubcap' });
W('launcher', TS + 'Weapon/Grenade Launcher.glb', { len: 0.8, name: 'Pipe Launcher' });
W('coil', 'proc:coil', { len: 0.6, name: 'Lightning Coil (procedural)' });
W('saw', 'proc:chainsaw', { len: 0.75, name: 'Chainsaw (procedural)' });
W('rail', TS + 'Weapon/Sniper.glb', { len: 0.9, tint: [0.8, 0.95, 1.2], name: 'Rail Rifle' });
W('rifle', TS + 'Weapon/AK.glb', { len: 0.8, name: 'Rifle (extra)' });
W('axe', ZK + 'Weapon/Axe.glb', { len: 0.8, name: 'Axe (extra)' });
W('knife', ZK + 'Weapon/Knife.glb', { len: 0.45, name: 'Knife (extra)' });

// ---------------- ground tiles ----------------
const AC = (n) => `${X}ambientcg/${n}/${n}_1K-JPG_`;
const tv = (name, n, o = {}) => ({ name, map: AC(n) + 'Color.jpg', normal: AC(n) + 'NormalGL.jpg', repeat: o.repeat || 1, tint: o.tint, normalScale: o.ns || 1 });
add('tiles.ground', 'tiles/ground.webp', { kind: 'tile', tileM: 1.6, cell: [128, 64], quality: 0.9, variants: [
  tv('asphalt', 'Asphalt012'), tv('asphalt2', 'Asphalt015'), tv('concrete', 'Concrete034'), tv('grass', 'Grass004', { tint: [0.9, 1, 0.85] }), tv('grass2', 'Grass001'),
  tv('dirt', 'Ground037'), tv('dirt2', 'Ground054'), tv('gravel', 'Gravel022'), tv('paving', 'PavingStones070'), tv('planks', 'Planks021'), tv('rust', 'Rust004')] }, { kind: 'tiles' });
// road chunks (Quaternius street pieces, same look as the zombies): 4 x 4 tiles = 6.4 m
for (const [id, file] of [['straight', 'Street Straight'], ['crack1', 'Street Straight Crack 1'], ['crack2', 'Street Straight Crack 2'], ['t', 'Street T'], ['turn', 'Street Turn'], ['cross', 'Street 4 Way']]) {
  add('road.' + id, `tiles/road-${id}.webp`, { url: ZK + 'Ground/' + file + '.glb', width: 6.4, center: true, cell: [512, 288], anchor: [256, 128], dirs: [0, 2], yaw: -45, shadow: false, outline: false, quality: 0.85, castShadow: false }, { kind: 'road', tiles: [4, 4] });
}
module.exports = { roots: { '/a/': S + '/asset-dl', '/x/': S + '/asset-x' }, jobs, PPM };
