'use strict';
// Balance report from the command line: plays many headless games per preset.
//   node tools/balance.js [games] [preset|all] [sizes...]
//   node tools/balance.js 1000 chaos 8 12 16
//   --reads=N  how sharp the Town players are (default 20 = a group that reads faces and
//              table talk, which the defaults are tuned for; 0 = bots voting on public info only)
const { runBatch } = require('../sim');
const { PRESETS } = require('../public/shared/roles');

const flags = process.argv.filter((a) => a.startsWith('--'));
process.argv = process.argv.filter((a) => !a.startsWith('--'));
const readsFlag = flags.find((a) => a.startsWith('--reads='));
const reads = readsFlag ? Number(readsFlag.slice(8)) || 0 : 20;
const games = Number(process.argv[2]) || 500;
const which = process.argv[3] || 'all';
const sizes = process.argv.slice(4).map(Number).filter((n) => n >= 3 && n <= 100);
const presets = which === 'all' ? Object.keys(PRESETS) : [which];

for (const id of presets) {
  const pr = PRESETS[id];
  if (!pr) { console.error(`Unknown preset "${id}". Try: ${Object.keys(PRESETS).join(', ')}`); process.exit(1); }
  const n = sizes.length ? sizes : id === 'storytellers' ? [14, 25, 50] : id === 'bigParty' ? [30, 60, 100] : [7, 10, 14];
  const r = runBatch({ games, players: n, settings: pr.settings, reads });
  console.log(`\n=== ${pr.label} · ${r.games} games · sizes ${n.join('/')} · ${(r.elapsedMs / 1000).toFixed(1)}s · reads ${reads} ===`);
  if (r.errors.length) console.log('  problems:', r.errors.join('; '));
  console.log('  win rates:', Object.entries(r.winRates).map(([k, v]) => `${k} ${v}%`).join(' · '), `· avg ${r.avgDays} days (~${r.avgMinutes} min)`);
  for (const [size, s] of Object.entries(r.byPlayerCount)) console.log(`    ${size} players: ${Object.entries(s.wins).map(([k, v]) => `${k} ${v}%`).join(' · ')} · ${s.avgDays} days`);
  console.table(Object.fromEntries(Object.entries(r.roles).map(([k, s]) => [k, { played: s.count, 'survived %': s.survivalRate, 'won %': s.winRate }])));
  console.log('  eliminations:', JSON.stringify(r.eliminations));
  console.log('  effectiveness:', JSON.stringify(r.effectiveness));
}
