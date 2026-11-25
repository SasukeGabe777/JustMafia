'use strict';
// node restage.js <renderOut> <dest> [idRegex]
// Re-stages some re-rendered sprites without rebuilding the whole manifest: copies each atlas from
// <renderOut> (render.js output) into <dest> (public/box/games/trash-assets) and refreshes that asset's
// cell / anchor / size / animation rows in manifest.json (names, scale and everything else stay).
const fs = require('fs'), path = require('path');
const [, , OUT, DEST, RE] = process.argv;
const re = RE ? new RegExp(RE) : null;
const mf = path.join(DEST, 'manifest.json'), man = JSON.parse(fs.readFileSync(mf, 'utf8'));
let n = 0;
for (const f of fs.readdirSync(path.join(OUT, '_meta'))) {
  const m = JSON.parse(fs.readFileSync(path.join(OUT, '_meta', f), 'utf8'));
  if (re && !re.test(m.id)) continue;
  const a = man.assets[m.id]; if (!a) { console.log('skip (not in the manifest)', m.id); continue; }
  fs.copyFileSync(path.join(OUT, m.file), path.join(DEST, m.file));
  const anims = {};
  for (const r of m.rows || []) { const an = anims[r.anim] || (anims[r.anim] = { frames: r.frames, fps: r.fps, loop: r.loop, rows: {} }); an.rows[r.dirName] = r.row; }
  Object.assign(a, { file: m.file, cell: m.cell, anchor: m.anchor, size: m.size, anims, dirs: [...new Set((m.rows || []).map((r) => r.dirName))] });
  n++;
}
fs.writeFileSync(mf, JSON.stringify(man, null, 1) + '\n');
console.log('restaged', n);
