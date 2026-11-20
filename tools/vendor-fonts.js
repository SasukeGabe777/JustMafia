'use strict';
// Download the Google Fonts the pages use into public/fonts/ so they work offline (the desktop /
// Steam app runs with no internet) and no page calls Google's servers.
//   node tools/vendor-fonts.js        (re-run only to add a family; commit the result)
// Writes public/fonts/fonts.css (every @font-face; the browser only downloads the files a page
// actually uses), public/fonts/files/*.woff2 (latin + latin-ext subsets only), and each family's
// licence (OFL / Apache 2.0) under public/fonts/licenses/, listed in THIRD_PARTY_NOTICES.md.
const fs = require('fs');
const path = require('path');

const FAMILIES = [
  'Fredoka:wght@400;500;600;700', 'Lilita One', 'Nunito:wght@600;700;800', 'Pixelify Sans:wght@400;500;600;700',
  'Bangers', 'Bungee', 'Bungee Shade', 'Caveat Brush', 'Monoton', 'Pacifico', 'Permanent Marker', 'Press Start 2P',
  'Righteous', 'Rubik Mono One', 'Special Elite', 'Abril Fatface', 'Black Ops One', 'Luckiest Guy',
  'Cinzel Decorative:wght@700;900', 'Cinzel:wght@600;700;800', 'MedievalSharp', 'Anton',
];
const SUBSETS = new Set(['latin', 'latin-ext']);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const OUT = path.join(__dirname, '..', 'public', 'fonts');

async function get(url, binary) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return binary ? Buffer.from(await r.arrayBuffer()) : r.text();
}
const slugOf = (fam) => fam.split(':')[0].toLowerCase().replace(/[^a-z0-9]/g, '');

async function main() {
  fs.mkdirSync(path.join(OUT, 'files'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'licenses'), { recursive: true });
  const css = ['/* Self-hosted Google Fonts (tools/vendor-fonts.js). Licences: /fonts/licenses/ and THIRD_PARTY_NOTICES.md. */'];
  const files = new Map(); // remote url -> local name
  const licences = [];
  for (const fam of FAMILIES) {
    const url = 'https://fonts.googleapis.com/css2?family=' + fam.replace(/ /g, '+') + '&display=swap';
    const text = await get(url);
    const blocks = [...text.matchAll(/\/\* ([\w-]+) \*\/\s*(@font-face \{[^}]+\})/g)];
    let kept = 0;
    for (const [, subset, block] of blocks) {
      if (!SUBSETS.has(subset)) continue;
      const remote = (block.match(/url\((https:[^)]+)\)/) || [])[1];
      if (!remote) continue;
      if (!files.has(remote)) {
        const name = `${slugOf(fam)}-${subset}-${files.size}.woff2`;
        fs.writeFileSync(path.join(OUT, 'files', name), await get(remote, true));
        files.set(remote, name);
      }
      css.push(`/* ${fam.split(':')[0]} ${subset} */\n` + block.replace(remote, 'files/' + files.get(remote)));
      kept++;
    }
    if (!kept) throw new Error('no latin faces for ' + fam);
    // The licence text from the google/fonts repository (ofl/, apache/ or ufl/).
    const slug = slugOf(fam);
    let lic = null;
    for (const [dir, file, name] of [['ofl', 'OFL.txt', 'SIL Open Font License 1.1'], ['apache', 'LICENSE.txt', 'Apache License 2.0'], ['ufl', 'LICENCE.txt', 'Ubuntu Font Licence 1.0']]) {
      try { const t = await get(`https://raw.githubusercontent.com/google/fonts/main/${dir}/${slug}/${file}`); lic = { name, text: t }; break; } catch { /* try the next folder */ }
    }
    if (!lic) throw new Error('licence not found for ' + fam);
    fs.writeFileSync(path.join(OUT, 'licenses', slug + '.txt'), lic.text);
    licences.push(`${fam.split(':')[0]}: ${lic.name} (licenses/${slug}.txt)`);
    console.log('  ✓', fam.split(':')[0], '-', lic.name);
  }
  fs.writeFileSync(path.join(OUT, 'fonts.css'), css.join('\n') + '\n');
  fs.writeFileSync(path.join(OUT, 'licenses', 'README.txt'), 'Fonts in /fonts/files come from Google Fonts (fonts.google.com), self-hosted.\n\n' + licences.join('\n') + '\n');
  console.log(`  ${files.size} font files, ${FAMILIES.length} families → public/fonts/`);
}
main().catch((e) => { console.error(e); process.exit(1); });
