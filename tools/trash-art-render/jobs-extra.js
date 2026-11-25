// 2D extras for render.js: the fx atlas re-encoded to WebP, and UI icons packed from the pickup/weapon spin atlases.
// env OUT = render output (with pickups/ and _meta/), FX = the fx atlas PNG (Kenney particles + Sinestesia blood, packed earlier).
const fs = require('fs'), path = require('path');
const OUT = process.env.OUT, FX = process.env.FX;
const metas = fs.readdirSync(path.join(OUT, '_meta')).filter((f) => /^(pickup|weapon)\./.test(f)).map((f) => JSON.parse(fs.readFileSync(path.join(OUT, '_meta', f), 'utf8'))).sort((a, b) => a.id.localeCompare(b.id));
const items = metas.map((m) => ({ name: m.id.replace(/^pickup\./, 'icon.').replace(/^weapon\./, 'icon.weapon.'), src: '/o/' + m.file, rect: [0, 0, m.cell[0], m.cell[1]] }));
const jobs = [{ id: 'ui.icons', file: 'ui/icons.webp', spec: { kind: 'pack', items, cell: [96, 96], cols: 10, quality: 0.9 } }];
if (FX) jobs.push({ id: 'fx.atlas', file: 'fx/fx.webp', spec: { kind: 'image', src: '/fx/' + path.basename(FX), quality: 0.88 } });
module.exports = { roots: { '/o/': OUT, '/fx/': FX ? path.dirname(FX) : OUT }, jobs };
