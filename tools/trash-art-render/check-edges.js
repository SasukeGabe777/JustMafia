'use strict';
// node tools/trash-art-render/check-edges.js [idRegex] [--json]
// Scans every frame of every animated sheet in public/box/games/trash-assets (zombies, bosses, survivors,
// NPCs, rides by default) and FAILS if a frame's solid pixels touch its cell's top, left or right edge:
// that frame was clipped by the render cell (e.g. a death fall cutting the head off). The bottom edge is
// allowed (shadows / blood decals may run off it). Decodes the WebP atlases in headless muted Chrome.
const fs = require('node:fs'), path = require('node:path');
const { Browser, cleanup } = require('../cdp');
const DIR = path.join(__dirname, '..', '..', 'public', 'box', 'games', 'trash-assets');
const re = new RegExp(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '^(zombie|boss|survivor|npc|vehicle|heli|fly)\\.');
const ALPHA = 40; // solid enough to count (soft outline fringe below this is fine)

(async () => {
  const man = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
  const ids = Object.keys(man.assets).filter((k) => re.test(k) && man.assets[k].anims && !man.assets[k].rect);
  const br = new Browser({ debugPort: 9520 + Math.floor(Math.random() * 60) }); await br.launch(); const pg = await br.page();
  await pg.go('about:blank');
  const bad = []; let frames = 0;
  for (const id of ids) {
    const a = man.assets[id], file = path.join(DIR, a.file); if (!fs.existsSync(file)) { bad.push({ id, why: 'missing file' }); continue; }
    const b64 = fs.readFileSync(file).toString('base64'), mime = a.file.endsWith('.png') ? 'image/png' : 'image/webp';
    const rows = []; for (const [an, A] of Object.entries(a.anims)) for (const [dir, row] of Object.entries(A.rows)) rows.push({ an, dir, row, n: A.frames });
    const r = await pg.eval(`(async () => {
      const im = new Image(); im.src = 'data:${mime};base64,${b64}'; await im.decode();
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
      const [cw, ch] = ${JSON.stringify(a.cell)}, rows = ${JSON.stringify(rows)}, out = []; let n = 0;
      for (const R of rows) for (let f = 0; f < R.n; f++) {
        const x0 = f * cw, y0 = R.row * ch; if (x0 + cw > im.width || y0 + ch > im.height) continue; n++;
        const d = g.getImageData(x0, y0, cw, ch).data, A = (x, y) => d[(y * cw + x) * 4 + 3];
        let top = 0, left = 0, right = 0;
        for (let x = 0; x < cw; x++) if (A(x, 0) > ${ALPHA}) top++;
        for (let y = 0; y < ch; y++) { if (A(0, y) > ${ALPHA}) left++; if (A(cw - 1, y) > ${ALPHA}) right++; }
        if (top || left || right) out.push({ an: R.an, dir: R.dir, f, top, left, right });
      }
      return { n, out };
    })()`);
    frames += r.n;
    if (r.out.length) bad.push({ id, n: r.out.length, first: r.out.slice(0, 4) });
    console.log((r.out.length ? 'CLIPPED ' : 'ok      ') + id + ' (' + r.n + ' frames' + (r.out.length ? ', ' + r.out.length + ' touch an edge: ' + [...new Set(r.out.map((o) => o.an))].join(',') : '') + ')');
  }
  cleanup();
  console.log(`\n${ids.length} sheets, ${frames} frames, ${bad.length} with clipped frames`);
  if (process.argv.includes('--json')) console.log(JSON.stringify(bad, null, 1));
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); cleanup(); process.exit(1); });
