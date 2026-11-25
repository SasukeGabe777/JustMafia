// Contact sheets built from the staged atlases + _meta (env STAGE = staged folder, META = meta folder).
const fs = require('fs'), path = require('path');
const STAGE = process.env.STAGE, META = process.env.META || path.join(STAGE, '_meta');
const metas = fs.readdirSync(META).filter((f) => !process.env.ONLY || new RegExp(process.env.ONLY).test(f)).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(META, f), 'utf8'))).sort((a, b) => a.id.localeCompare(b.id));
const items = [];
const order = ['zombie', 'boss', 'survivor', 'npc', 'vehicle', 'turret', 'chest', 'garage', 'pickup', 'weapon', 'prop', 'bld', 'road', 'tiles', 'fx', 'ui'];
metas.sort((a, b) => order.findIndex((o) => a.id.startsWith(o)) - order.findIndex((o) => b.id.startsWith(o)) || a.id.localeCompare(b.id));
for (const m of metas) {
  const src = '/o/' + m.file.replace(/\\/g, '/');
  if (m.variants) { m.variants.forEach((v, i) => items.push({ src, rect: [i * m.cell[0], 0, m.cell[0], m.cell[1]], label: 'tile.' + v, maxScale: 1.4 })); continue; }
  const rows = m.rows || [];
  const pick = (anim, dir, last) => rows.find((r) => r.anim === anim && r.dir === dir) || rows.find((r) => r.anim === anim) || rows[0];
  if (m.kind === 'character') {
    const w = pick('walk', 1) || pick('idle', 0), a = pick('attack', 3), d = pick('death', 1);
    items.push({ src, rect: [3 * m.cell[0], w.row * m.cell[1], m.cell[0], m.cell[1]], label: m.id + ' ' + w.anim, maxScale: 1.6 });
    if (a && process.env.ATTACK) items.push({ src, rect: [Math.floor(a.frames / 2) * m.cell[0], a.row * m.cell[1], m.cell[0], m.cell[1]], label: m.id + ' attack NE', maxScale: 1.6 });
    items.push({ src, rect: [(d.frames - 1) * m.cell[0], d.row * m.cell[1], m.cell[0], m.cell[1]], label: m.id + ' dead', maxScale: 1.6 });
  } else if (m.kind === 'chest' || m.id === 'garage.door') {
    for (const an of ['closed', 'opening', 'open']) { const r = pick(an, 1); items.push({ src, rect: [(an === 'opening' ? Math.floor(r.frames / 2) : 0) * m.cell[0], r.row * m.cell[1], m.cell[0], m.cell[1]], label: m.id + ' ' + an }); }
  } else {
    const r = rows.find((x) => x.dir === 1) || rows[0];
    items.push({ src, rect: [0, (r ? r.row : 0) * m.cell[1], m.cell[0], m.cell[1]], label: m.id, maxScale: m.kind === 'pickup' ? 1.6 : 1 });
  }
}
const jobs = [{ id: 'contact', file: process.env.SHEET_OUT || 'contact.png', spec: { kind: 'sheet', title: 'JustZombies iso assets (staged) - one frame each, shown at up to 1.6x', items, cols: 12, cellW: 200, cellH: 200, bg: '#5d6b54' } }];
// zombie walk + death strip
const zid = process.env.STRIP || 'zombie.walker', zm = metas.find((m) => m.id === zid);
if (zm) {
  const its = []; const w = zm.rows.find((r) => r.anim === 'walk' && r.dir === 1), d = zm.rows.find((r) => r.anim === 'death' && r.dir === 1);
  for (let f = 0; f < w.frames; f++) its.push({ src: '/o/' + zm.file, rect: [f * zm.cell[0], w.row * zm.cell[1], zm.cell[0], zm.cell[1]], label: `walk SE ${f + 1}/${w.frames}`, maxScale: 1 });
  for (let f = 0; f < d.frames; f++) its.push({ src: '/o/' + zm.file, rect: [f * zm.cell[0], d.row * zm.cell[1], zm.cell[0], zm.cell[1]], label: `death SE ${f + 1}/${d.frames}`, maxScale: 1 });
  jobs.push({ id: 'strip', file: process.env.STRIP_OUT || 'strip.png', spec: { kind: 'sheet', title: zid + ': walk (12 frames) + death (16 frames), SE direction, 1:1', items: its, cols: 14, cellW: zm.cell[0], cellH: zm.cell[1] + 22, bg: '#55604d' } });
}
module.exports = { roots: { '/o/': STAGE }, jobs };
