// JustZombies biomes (country, frozen, volcano): props and buildings in the cartoon toon look with ink lines.
// Kenney Nature Kit models (CC0, recoloured: snowy pines, snow rocks, lava rocks, corn, wheat, fences, logs, tents)
// and our own procedural models (barn, silo, hay bale, scarecrow, log cabin, ski lodge, steam vent, the volcano).
// node render.js jobs-biome.js <outDir>   then   node stage-v3.js <outDir> <public/box/games/trash-assets>
const base = require('./jobs.js');
const { PPM } = base;
const NK = (n) => `/x/kenney-nature-kit/Models/GLTF format/${n}.glb`;
const TOON = { sat: 1.3, light: 1.05, ink: 0.025 };
const jobs = [];
const P = (id, url, o = {}) => jobs.push({ id: 'prop.' + id, file: `props/prop-${id}.webp`, spec: {
  ppm: PPM, url, height: o.h, length: o.len, width: o.w, cell: o.cell || [160, 160], anchor: o.anchor || [80, 112], dirs: o.dirs || [0], yaw: o.yaw || 0, fit: true,
  tint: o.tint, matTint: o.matTint, emissive: o.emissive, emissiveIntensity: o.ei, quality: 0.85, light: o.light, outlinePx: 2, outlineColor: 'rgba(18,10,8,0.95)', toon: o.toon === false ? undefined : TOON,
  kind: url.startsWith('proc:') ? 'proc' : undefined, proc: url.startsWith('proc:') ? url.slice(5) : undefined,
}, extra: { kind: 'prop', name: o.name } });
const B = (id, proc, o) => jobs.push({ id: 'bld.' + id, file: `props/bld-${id}.webp`, spec: {
  ppm: PPM, url: 'proc:' + proc, kind: 'proc', proc, width: o.w, length: o.len, height: o.h, cell: o.cell || [480, 440], anchor: o.anchor || [240, 320], dirs: [0, 2], yaw: -45, fit: true,
  quality: 0.85, light: { shadowExtent: 14 }, outlinePx: 2, outlineColor: 'rgba(18,10,8,0.95)', toon: TOON,
}, extra: { kind: 'building', name: o.name } });
const tall = { cell: [192, 320], anchor: [96, 280], light: { shadowExtent: 8 } };
// ---- frozen ----
P('snowpine', NK('tree_pineTallA_detailed'), { h: 5.4, ...tall, matTint: [['leafs', '#e4eef6'], ['wood', '#5a4636']], name: 'Snowy pine (Kenney Nature Kit, recoloured)' });
P('snowpine2', NK('tree_pineRoundC'), { h: 4.4, ...tall, matTint: [['leafs', '#cfe0ea'], ['wood', '#5a4636']], name: 'Snowy round pine (Kenney Nature Kit, recoloured)' });
P('snowrock', NK('rock_largeA'), { len: 1.6, matTint: [['grass', '#f6f9ff'], ['dirt', '#8494a4']], name: 'Snow-capped rock (Kenney Nature Kit, recoloured)' });
P('icechunk', NK('stone_tallA'), { h: 1.8, cell: [128, 192], anchor: [64, 160], matTint: [['stone', '#a9dcff'], ['default', '#d8f2ff']], name: 'Ice spike (Kenney Nature Kit, recoloured)' });
P('logs', NK('log_stack'), { len: 1.6, matTint: [['woodBark', '#7a5232'], ['woodInner', '#e0b47a']], name: 'Log pile (Kenney Nature Kit)' });
P('tent', NK('tent_detailedOpen'), { len: 2.2, cell: [192, 192], anchor: [96, 128], matTint: [['colorRed', '#2f8fd8']], name: 'Tent (Kenney Nature Kit, recoloured)' });
P('campfire', NK('campfire_stones'), { len: 1.0, matTint: [['stone', '#8d8a8a']], emissive: 0x3a1400, ei: 0.4, name: 'Campfire (Kenney Nature Kit)' });
B('cabin', 'cabin', { w: 4.6, cell: [400, 380], anchor: [200, 280], name: 'Log cabin (our own model)' });
B('lodge', 'lodge', { w: 7.4, cell: [560, 480], anchor: [280, 340], name: 'Ski lodge (our own model)' });
// ---- country ----
P('corn', NK('crops_cornStageD'), { h: 2.2, matTint: [['grass', '#4f9a32'], ['corn', '#f2c94a']], cell: [128, 224], anchor: [64, 190], name: 'Tall corn (Kenney Nature Kit)' });
P('wheat', NK('crops_wheatStageB'), { len: 1.2, matTint: [['woodInner', '#e2c060'], ['default', '#c9a040']], name: 'Wheat (Kenney Nature Kit)' });
P('fence.farm', NK('fence_simple'), { len: 1.6, matTint: [['woodDark', '#6b4a2c'], ['wood', '#a8743a']], dirs: [1, 3], name: 'Farm fence (Kenney Nature Kit)' });
P('haybale', 'proc:haybale', { len: 1.5, name: 'Hay bale (our own model)' });
P('scarecrow', 'proc:scarecrow', { h: 2.4, cell: [160, 256], anchor: [80, 220], name: 'Scarecrow (our own model)' });
P('silo', 'proc:silo', { h: 6.0, cell: [224, 448], anchor: [112, 400], light: { shadowExtent: 10 }, name: 'Grain silo (our own model)' });
P('tractor', `/x/kenney-car-kit/Models/GLB format/tractor.glb`, { len: 3.0, dirs: [1, 3], cell: [256, 224], anchor: [128, 140], name: 'Old tractor (Kenney Car Kit)' });
B('barn', 'barn', { w: 5.4, cell: [520, 480], anchor: [260, 340], name: 'Red barn (our own model)' });
// ---- volcano ----
P('lavarock', NK('rock_largeC'), { len: 1.7, matTint: [['grass', '#ff7a2a'], ['dirt', '#2e2628']], emissive: 0x401000, ei: 0.35, name: 'Lava rock (Kenney Nature Kit, recoloured)' });
P('basalt', NK('stone_tallB'), { h: 2.4, cell: [128, 224], anchor: [64, 190], matTint: [['stone', '#3a3438'], ['default', '#2a2528']], name: 'Basalt column (Kenney Nature Kit, recoloured)' });
P('charred', 'proc:__none', { h: 1, name: 'placeholder' });
P('vent', 'proc:vent', { len: 1.6, name: 'Steam vent (our own model)' });
B('volcano', 'volcano', { w: 9.0, cell: [720, 560], anchor: [360, 400], name: 'The volcano (our own model)' });
// (no charred placeholder: dead trees are the Quaternius dead tree tinted dark, below)
jobs.splice(jobs.findIndex((j) => j.id === 'prop.charred'), 1);
P('deadtree.charred', '/a/gd-q-nature/Tree/Dead Tree 1.glb', { h: 4.0, ...tall, tint: [0.35, 0.3, 0.3], name: 'Charred tree (Quaternius Stylized Nature, darkened)' });
module.exports = { roots: base.roots, jobs, PPM };
