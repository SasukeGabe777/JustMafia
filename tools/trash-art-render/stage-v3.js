'use strict';
// node stage-v3.js <renderOut> <public/box/games/trash-assets>
// Copies the jobs-v3.js atlases (wider building cells, vehicles with a "drive" animation, our own
// ride-on mower) into the staged art folder and updates those entries in manifest.json.
const fs = require('fs'), path = require('path');
const [, , OUT, DEST] = process.argv;
const man = JSON.parse(fs.readFileSync(path.join(DEST, 'manifest.json'), 'utf8'));
const metas = fs.readdirSync(path.join(OUT, '_meta')).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(OUT, '_meta', f), 'utf8')));
for (const m of metas) {
  fs.copyFileSync(path.join(OUT, m.file), path.join(DEST, m.file));
  const old = man.assets[m.id] || {};
  const a = { ...old, file: m.file, kind: m.kind || old.kind, cell: m.cell, anchor: m.anchor, scale: old.scale || 1, size: m.size };
  if (m.name) a.name = m.name;
  const anims = {};
  for (const r of m.rows || []) { const an = anims[r.anim] || (anims[r.anim] = { frames: r.frames, fps: r.fps, loop: r.loop, rows: {} }); an.rows[r.dirName] = r.row; }
  a.anims = anims; a.dirs = [...new Set((m.rows || []).map((r) => r.dirName))];
  if (a.dirs.length === 5) a.mirror = { SW: 'SE', W: 'E', NW: 'NE' }; else delete a.mirror;
  man.assets[m.id] = a;
  console.log('staged', m.id, m.file, JSON.stringify(m.cell), Object.keys(anims).join(','));
}
fs.writeFileSync(path.join(DEST, 'manifest.json'), JSON.stringify(man, null, 1));
