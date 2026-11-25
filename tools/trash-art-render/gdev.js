// node gdev.js <tagSubstring> <outDir> [--list]
const fs = require('fs'), path = require('path');
const [, , tag, out, flag] = process.argv;
(async () => {
  const hdrs = await (await fetch('https://resources.gdevelop-app.com/assets-database/assetShortHeaders.json')).json();
  const sel = hdrs.filter(h => ((h.tags || [])[0] || '').toLowerCase() === tag.toLowerCase());
  console.log('matched', sel.length, 'license sample:', JSON.stringify(sel[0] && { tags: sel[0].tags, lic: sel[0].license, auth: sel[0].authors }));
  fs.mkdirSync(out, { recursive: true });
  for (const h of sel) {
    const r = await fetch('https://resources.gdevelop-app.com/assets-database/assets/' + h.id + '.json');
    if (!r.ok) { console.log('no asset json', h.name, r.status); continue; }
    const a = await r.json();
    const res = (a.objectAssets || []).flatMap(o => o.resources || []);
    for (const rs of res) {
      const url = rs.file; const name = decodeURIComponent(url.split('/').pop()).replace(/^[0-9a-f]{20,}_/, '');
      const sub = decodeURIComponent(url.split('/').slice(-2, -1)[0]);
      const p = path.join(out, sub, name);
      console.log(a.license || '', (a.authors||[]).join?.(',') || '', p);
      if (flag === '--list' || fs.existsSync(p)) continue;
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, Buffer.from(await (await fetch(url)).arrayBuffer()));
    }
  }
})();
