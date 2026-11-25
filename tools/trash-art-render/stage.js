'use strict';
// node stage.js <renderOut> <dest> <oldStage> <assetX>
// Copies the rendered atlases into <dest> (public/box/games/trash-assets), adds the sounds, and writes manifest.json.
// renderOut: output of `render.js jobs.js` + `render.js jobs-extra.js` (atlases + _meta)
// oldStage: earlier staging folder holding sfx/*.ogg and manifest.json (fx frame rects + sfx list)
// assetX: extracted Kenney packs (extra sounds)
const fs = require('fs'), path = require('path');
const [, , OUT, DEST, OLD, AX] = process.argv;
const { PPM } = require('./jobs.js');
const rd = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const cp = (a, b) => { fs.mkdirSync(path.dirname(b), { recursive: true }); fs.copyFileSync(a, b); };
const metas = fs.readdirSync(path.join(OUT, '_meta')).filter((f) => f.endsWith('.json')).map((f) => rd(path.join(OUT, '_meta', f)));
const old = rd(path.join(OLD, 'manifest.json'));

// Ogg Vorbis length: last page granule / sample rate.
function oggSeconds(file) {
  const b = fs.readFileSync(file); const rate = b.readUInt32LE(40); // identification header follows the first 28-byte page header + 1 segment byte
  let i = b.lastIndexOf(Buffer.from('OggS')); const gran = Number(b.readBigUInt64LE(i + 6));
  return rate > 0 ? +(gran / rate).toFixed(2) : null;
}

const DIRS = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW'];
const assets = {};
for (const m of metas) {
  if (m.id === 'ui.icons' || m.id === 'fx.atlas' || m.id === 'tiles.ground') continue;
  cp(path.join(OUT, m.file), path.join(DEST, m.file));
  const a = { file: m.file, kind: m.kind, cell: m.cell, anchor: m.anchor, scale: m.kind === 'pickup' || m.kind === 'weapon' ? 0.5 : 1 };
  if (m.name) a.name = m.name; if (m.look) a.look = m.look; if (m.use) a.use = m.use; if (m.boss) a.boss = true; if (m.tiles) a.tiles = m.tiles;
  a.size = m.size; // metres (x, height, z) after normalising
  const anims = {};
  for (const r of m.rows || []) {
    const an = anims[r.anim] || (anims[r.anim] = { frames: r.frames, fps: r.fps, loop: r.loop, rows: {} });
    an.rows[r.dirName] = r.row;
  }
  a.anims = anims;
  const dirs = [...new Set((m.rows || []).map((r) => r.dirName))];
  a.dirs = dirs;
  if (dirs.length === 5) a.mirror = { SW: 'SE', W: 'E', NW: 'NE' };
  assets[m.id] = a;
}
// ground tiles (one row of 128x64 diamonds)
const tg = metas.find((m) => m.id === 'tiles.ground');
if (tg) {
  cp(path.join(OUT, tg.file), path.join(DEST, tg.file));
  tg.variants.forEach((v, i) => { assets['tile.' + v] = { file: tg.file, kind: 'tile', cell: tg.cell, anchor: [tg.cell[0] / 2, tg.cell[1] / 2], rect: [i * tg.cell[0], 0, tg.cell[0], tg.cell[1]], scale: 1 }; });
}

// fx: same packed frames as before, re-encoded to WebP
cp(path.join(OUT, 'fx/fx.webp'), path.join(DEST, 'fx/fx.webp'));
const fx = {};
for (const [k, v] of Object.entries(old.fx)) fx['fx.' + k] = { ...v, file: 'fx/fx.webp', frameFormat: '[x, y, w, h, ax, ay]' };

// ui icons
const ui = {};
const icm = metas.find((m) => m.id === 'ui.icons');
if (icm) { cp(path.join(OUT, 'ui/icons.webp'), path.join(DEST, 'ui/icons.webp')); icm.names.forEach((n, i) => { ui[n] = { file: 'ui/icons.webp', rect: icm.rects[i] }; }); }

// sfx: earlier set + extra Kenney clips
const sfx = {};
for (const [k, v] of Object.entries(old.sfx)) { cp(path.join(OLD, v.file), path.join(DEST, v.file)); sfx['sfx.' + k] = { file: v.file, seconds: v.seconds, loop: !!v.loop, source: v.source }; }
const extra = [
  ['chest.open', 'kenney-rpg-audio', 'creak1.ogg', 'rpg-audio'], ['chest.latch', 'kenney-rpg-audio', 'metalLatch.ogg', 'rpg-audio'], ['coins', 'kenney-rpg-audio', 'handleCoins.ogg', 'rpg-audio'],
  ['swing.bat', 'kenney-impact-sounds', 'impactPunch_heavy_000.ogg', 'impact'], ['crossbow', 'kenney-rpg-audio', 'drawKnife1.ogg', 'rpg-audio'], ['flamer.loop', 'kenney-sci-fi-sounds', 'thrusterFire_000.ogg', 'sci-fi', true],
  ['blower.loop', 'kenney-sci-fi-sounds', 'spaceEngineLow_000.ogg', 'sci-fi', true], ['chainsaw.loop', 'kenney-sci-fi-sounds', 'engineCircular_000.ogg', 'sci-fi', true], ['hubcap', 'kenney-impact-sounds', 'impactPlate_medium_000.ogg', 'impact'],
  ['nailgun', 'kenney-impact-sounds', 'impactTin_medium_000.ogg', 'impact'], ['rail', 'kenney-sci-fi-sounds', 'laserLarge_000.ogg', 'sci-fi'], ['zap', 'kenney-dig' + 'ital-audio', 'zap1.ogg', 'digital-audio'],
  ['garage.door', 'kenney-sci-fi-sounds', 'doorOpen_000.ogg', 'sci-fi'], ['build', 'kenney-impact-sounds', 'impactWood_heavy_000.ogg', 'impact'], ['slime', 'kenney-sci-fi-sounds', 'slime_000.ogg', 'sci-fi'],
  ['alarm', 'kenney-dig' + 'ital-audio', 'twoTone1.ogg', 'digital-audio'], ['freeze.crack', 'kenney-impact-sounds', 'impactGlass_heavy_000.ogg', 'impact'], ['punch', 'kenney-impact-sounds', 'impactPunch_medium_000.ogg', 'impact'],
];
const findFile = (dir, name) => { const st = [dir]; while (st.length) { const d = st.pop(); for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) st.push(p); else if (e.name === name) return p; } } return null; };
for (const [k, pack, name, source, loop] of extra) {
  const src = findFile(path.join(AX, pack), name); if (!src) { console.log('missing sound', pack, name); continue; }
  const file = 'sfx/' + k.replace(/\./g, '-') + '.ogg'; cp(src, path.join(DEST, file));
  sfx['sfx.' + k] = { file, seconds: oggSeconds(src), loop: !!loop, source: 'kenney ' + source };
}

// game-facing aliases: logical names the game uses -> asset ids
const aliases = {
  'boss.boss': 'boss.dumpster', 'boss.compactor': 'boss.compactor', 'boss.icecream': 'boss.icecream',
  'bld.market': 'bld.kk.e', 'bld.surplus': 'bld.kk.a', 'bld.clinic': 'bld.kk.g', 'bld.gun1': 'bld.kk.b', 'bld.gun2': 'bld.kk.f', 'bld.gun3': 'bld.kk.h',
  'bld.shop1': 'bld.kk.c', 'bld.shop2': 'bld.kk.d', 'bld.shop3': 'bld.office',
  'npc.merchant': 'npc.tinker', 'npc.merchant.rank1': 'npc.tinker', 'npc.merchant.rank2': 'npc.gunsmith', 'npc.merchant.rank3': 'npc.master',
  'hero': 'survivor.shaun', 'survivor': 'survivor.lis', 'escort': 'survivor.sam',
  'buildable.barricade': 'prop.barricade', 'buildable.turret': 'turret', 'buildable.spikes': 'prop.spikes', 'buildable.sprinkler': 'prop.sprinkler', 'buildable.alarm': 'prop.alarm', 'buildable.alarm.car': 'vehicle.sedan',
  'vehicle.wreck': 'prop.wreck', 'vehicle.wreck.burnt': 'prop.wreck.burnt', 'vehicle.wreck.suv': 'prop.wreck.suv',
  'prop.trashcan': 'prop.bin', 'prop.fence.wood': 'prop.fence', 'prop.tree.pine': 'prop.pine',
  'pickup.bossCore': 'pickup.core', 'pickup.chest': 'chest', 'pickup.keychest': 'chest.key',
  'sfx.pistol': 'sfx.gun.pistol', 'sfx.shotgun': 'sfx.gun.shotgun', 'sfx.smg': 'sfx.gun.smg', 'sfx.nailgun': 'sfx.nailgun', 'sfx.bat': 'sfx.swing.bat', 'sfx.crossbow': 'sfx.crossbow',
  'sfx.flamer': 'sfx.flamer.loop', 'sfx.blower': 'sfx.blower.loop', 'sfx.hubcap': 'sfx.hubcap', 'sfx.launcher': 'sfx.gun.heavy', 'sfx.coil': 'sfx.gun.lightning', 'sfx.saw': 'sfx.chainsaw.loop',
  'sfx.rail': 'sfx.rail', 'sfx.minigun': 'sfx.gun.minigun', 'sfx.rockets': 'sfx.gun.rocket', 'sfx.raygun': 'sfx.gun.raygun', 'sfx.rifle': 'sfx.gun.rifle', 'sfx.sniper': 'sfx.gun.sniper',
  'sfx.groan': 'sfx.zombie.groan.a', 'sfx.hit': 'sfx.hit.flesh', 'sfx.pickup': 'sfx.pickup', 'sfx.levelup': 'sfx.level.up', 'sfx.explosion': 'sfx.explosion', 'sfx.engine': 'sfx.engine.loop', 'sfx.rain': 'sfx.rain.loop', 'sfx.chest': 'sfx.chest.open',
};
for (const [k, v] of Object.entries(aliases)) if (!assets[v] && !sfx[v]) console.log('alias target missing', k, v);

const tileW = 128, tileH = 64;
const manifest = {
  version: 2,
  note: 'JustZombies isometric art (CC0, see CREDITS.md). Re-render with tools/trash-art-render.',
  projection: {
    type: 'dimetric 2:1 ("pixel isometric"), orthographic', cameraElevationDeg: 30, cameraAzimuthDeg: 45,
    tile: { w: tileW, h: tileH, metres: 1.6, note: 'one ground tile is a 1.6 m square, drawn as a 128 x 64 diamond' },
    pxPerMetre: +PPM.toFixed(4),
    worldToScreen: 'tiles (tx, ty) -> screen: sx = (tx - ty) * 64, sy = (tx + ty) * 32; a height of z metres rises z * 48.99 px (pxPerMetre * cos 30)',
    light: 'one rig for everything: warm key light from the screen top-left, sky/ground hemisphere fill, cool back fill; soft cast shadows baked into each frame',
  },
  directions: {
    names: 'screen directions: S = toward the bottom of the screen (facing the viewer), E = screen right, N = away from the viewer',
    rendered: ['S', 'SE', 'E', 'NE', 'N'], mirror: { SW: 'SE', W: 'E', NW: 'NE' },
    mirrorHow: 'draw the mirrored source row flipped horizontally; anchor x becomes (cell w - anchor x)',
    pick: 'with world velocity (vx, vy) in tile axes: sx = vx - vy, sy = (vx + vy) / 2; dir = ["E","SE","S","SW","W","NW","N","NE"][Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) & 7]',
    order: DIRS,
  },
  frames: {
    layout: 'atlases are grids of cell-sized frames: x = frame * cell[0], y = anims[name].rows[dir] * cell[1]',
    anchor: 'anchor = the ground point under the object (feet / footprint centre) inside one cell; put it on the projected world position',
    scale: 'draw at scale * (your tile width / 128). Pickups and weapons are rendered at 2x detail (scale 0.5)',
    pickups: 'pickups/weapons have one 8-frame "spin" anim (turntable); bob them in code',
    death: 'death plays once; hold the last frame (corpse + blood pool) then fade',
  },
  assets, aliases, fx, sfx, ui,
};
fs.writeFileSync(path.join(DEST, 'manifest.json'), JSON.stringify(manifest, null, 1));
const total = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? total(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0);
console.log('assets', Object.keys(assets).length, 'fx', Object.keys(fx).length, 'sfx', Object.keys(sfx).length, 'ui', Object.keys(ui).length, 'total MB', (total(DEST) / 1048576).toFixed(1));
