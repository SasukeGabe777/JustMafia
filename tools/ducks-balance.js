'use strict';
// JustRaiseDucks skill balance: races the real simulation (box/games/ducks.js simulate()) many
// times with hand-made ducks and prints how often each kind of duck wins. Run:
//   node tools/ducks-balance.js            (the full report, a few seconds)
//   node tools/ducks-balance.js --quick    (fewer races per row)
// The same helpers are used by the balance checks in tools/test-box-ducks.js.
const def = require('../box/games/ducks');
const D = def._test;
const SK = D.SKILLS;

// A tiny stand-in for BoxRoom: everything simulate() and newCourse() need, nothing else.
function fakeRoom(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  const rng = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s >>>= 0; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  for (let i = 0; i < 5; i++) rng();
  return { rng, get: () => ({}), name: () => 'x', fx() {}, after() { return 0; }, cancel() {}, now: () => 0, list: () => [] };
}
// A duck with these levels ({ run: 5, ... } or a number for all six) and nothing else (no gear,
// perks, mood bonus or tactic).
function duckWith(lv) {
  const xp = {}; for (const k of SK) xp[k] = D.xpFor(typeof lv === 'number' ? lv : lv[k] || 0);
  return D.migrate({ xp, gear: [], perks: [], mood: 60, energy: 100, tactic: 'steady' });
}
// One race: ducks = [[label, levels], ...]; returns the labels in finishing order.
// opts: terrain, course, theme (force a world), seed, race (race number, 1 = first).
function race(ducks, opts = {}) {
  const room = fakeRoom(opts.seed || 1);
  const g = def.create(room, { ...def.defaults, weather: false, races: 10, terrain: opts.terrain || 'mixed', course: opts.course || 'classic' });
  let c, tries = 0;
  do c = g.newCourse(opts.race || 2); while (opts.theme && c.theme !== opts.theme && ++tries < 500);
  g.course = c; g.race = (opts.race || 2) - 1;
  ducks.forEach(([label, lv], i) => g.ducks.set(label + '#' + i, duckWith(lv)));
  const { entries } = g.simulate();
  return entries.filter((e) => !/^w\d/.test(e.id)).sort((a, b) => a.time - b.time).map((e) => e.id.replace(/#\d+$/, ''));
}
const even = (L) => Object.fromEntries(SK.map((k) => [k, L]));
const plus = (L, k, n) => ({ ...even(L), [k]: L + n });

// (a) Six ducks, all skills at L, each with a different skill raised by n: win share per skill.
function oneRaised(L, n, opts = {}, N = 200) {
  const wins = Object.fromEntries(SK.map((k) => [k, 0]));
  for (let seed = 1; seed <= N; seed++) wins[race(SK.map((k) => [k, plus(L, k, n)]), { ...opts, seed })[0]]++;
  return Object.fromEntries(SK.map((k) => [k, wins[k] / N]));
}
// Head to head: in each race, every duck of team A against every duck of team B; the share of
// those pairs that A finishes ahead of.
function headToHead(A, B, opts = {}, N = 200) {
  let a = 0, pairs = 0;
  const field = [...A.map((lv) => ['A', lv]), ...B.map((lv) => ['B', lv])];
  for (let seed = 1; seed <= N; seed++) {
    const order = race(field, { ...opts, seed });
    let aSeen = 0;
    for (const x of order) { if (x === 'A') aSeen++; else { a += aSeen; pairs += A.length; } }
  }
  return a / pairs;
}
// (b) Specialists (the same total, all of it in one skill, others at 0; capped at the max level and
// the rest spread evenly) against balanced ducks. Returns the balanced side's share per skill.
function specialist(total, k) {
  const o = even(0), top = Math.min(D.SKILLS.length * 25, total), main = Math.min(25, top);
  o[k] = main; let left = top - main;
  const rest = SK.filter((x) => x !== k); for (let i = 0; left > 0; i = (i + 1) % rest.length) { o[rest[i]]++; left--; }
  return o;
}
// Lopsided: half the total in one skill, the other half spread evenly over the other five.
function lopsided(total, k) {
  const o = even(0), main = Math.min(25, Math.round(total / 2)); o[k] = main;
  let left = total - main; const rest = SK.filter((x) => x !== k); for (let i = 0; left > 0; i = (i + 1) % rest.length) { o[rest[i]]++; left--; }
  return o;
}
// (c) Balanced but one skill at 0 (the same total spread over the other five).
function missing(L, k) {
  const o = even(0); let left = L * SK.length; const rest = SK.filter((x) => x !== k);
  for (let i = 0; left > 0; i = (i + 1) % rest.length) { o[rest[i]]++; left--; }
  return o;
}

module.exports = { race, oneRaised, headToHead, specialist, lopsided, missing, even, plus, duckWith, SK };

if (require.main === module) {
  const quick = process.argv.includes('--quick'), N = quick ? 60 : 200;
  const pct = (v) => (100 * v).toFixed(0).padStart(3) + '%';
  const t0 = Date.now();
  console.log(`JustRaiseDucks balance (${N} races per row)\n`);
  console.log('(a) six ducks equal, one skill raised: win share per raised skill');
  console.log('terrain  course   levels   ' + SK.map((k) => k.padStart(8)).join('') + '   max/min');
  for (const terrain of ['mixed', 'classic', 'brainy']) for (const course of ['classic', 'sprint', 'marathon']) {
    if (course !== 'classic' && terrain !== 'mixed') continue;
    for (const [L, n] of [[1, 3], [4, 4], [8, 4], [14, 5]]) {
      const r = oneRaised(L, n, { terrain, course }, N), sk = terrain === 'classic' ? SK.filter((k) => k !== 'smarts') : SK;
      const vals = sk.map((k) => r[k]), ratio = Math.max(...vals) / Math.max(0.005, Math.min(...vals));
      console.log(`${terrain.padEnd(8)} ${course.padEnd(8)} L${String(L).padEnd(2)}+${n}   ` + SK.map((k) => pct(r[k]).padStart(8)).join('') + '   ' + ratio.toFixed(1) + 'x');
    }
  }
  console.log('\n(b) balanced vs specialist with the same total: how often the balanced duck finishes ahead');
  console.log('total   vs         ' + SK.map((k) => k.padStart(8)).join(''));
  for (const total of [12, 30, 60]) for (const [name, f] of [['all-in', specialist], ['half-in', lopsided]]) {
    const row = SK.map((k) => headToHead([even(total / 6), even(total / 6), even(total / 6)], [f(total, k), f(total, k), f(total, k)], {}, Math.round(N / 2)));
    console.log(`${String(total).padEnd(7)} ${name.padEnd(10)} ` + row.map((v) => pct(v).padStart(8)).join(''));
  }
  console.log('\n(c) balanced vs "all but one" (that skill at 0, the same total): how often the balanced duck finishes ahead');
  console.log('level   ' + SK.map((k) => ('no ' + k).padStart(11)).join(''));
  for (const L of [2, 5, 10]) {
    const row = SK.map((k) => headToHead([even(L), even(L), even(L)], [missing(L, k), missing(L, k), missing(L, k)], {}, Math.round(N / 2)));
    console.log(`L${String(L).padEnd(6)} ` + row.map((v) => pct(v).padStart(11)).join(''));
  }
  console.log('\n(d) every world (Everything terrain, L5+4): win share per raised skill');
  for (const theme of Object.keys(D.THEMES)) {
    const r = oneRaised(5, 4, { theme }, Math.round(N / 2));
    console.log(`${theme.padEnd(9)}` + SK.map((k) => pct(r[k]).padStart(8)).join(''));
  }
  console.log(`\n${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
