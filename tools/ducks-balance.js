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
// opts: terrain, course, theme (a race in that world), solo (a single-skill race of that skill),
// seed, race (race number, 1 = first), weather (default off), boss.
function race(ducks, opts = {}) {
  const { g } = courseFor(opts);
  ducks.forEach(([label, lv], i) => g.ducks.set(label + '#' + i, duckWith(lv)));
  const { entries } = g.simulate();
  return entries.filter((e) => !/^w\d/.test(e.id) && e.id !== 'boss').sort((a, b) => a.time - b.time).map((e) => e.id.replace(/#\d+$/, ''));
}
// A game set up at race n of a planned season (seed); with opts.theme / opts.solo, the first race
// (from that seed on) that is in that world / a single-skill race of that skill.
function courseFor(opts = {}) {
  const R = opts.races || 5;
  for (let tries = 0; tries < 2000; tries++) {
    const seed = (opts.seed || 1) + tries * 7919, room = fakeRoom(seed);
    const g = def.create(room, { ...def.defaults, weather: !!opts.weather, boss: !!opts.boss, races: R, terrain: opts.terrain || 'mixed', course: opts.course || 'classic' });
    const n = opts.race || 1 + (seed % R);
    let c; for (let i = 1; i <= n; i++) { c = g.newCourse(i); g.course = c; }
    g.race = n - 1;
    if ((opts.theme && c.theme !== opts.theme) || (opts.solo && c.solo !== opts.solo)) continue;
    return { g, c, room, seed };
  }
  throw new Error('no such race: ' + JSON.stringify(opts));
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
// A whole season (races 1..R of one planned series per seed): season points per duck (10, 8, 6, …
// like the game); the share of A-vs-B pairs where A ends the season with more points (ties: half).
const PTS = [10, 8, 6, 5, 4, 3, 2];
function seasonHeadToHead(A, B, opts = {}, N = 60) {
  const R = opts.races || 5, field = [...A.map((lv) => ['A', lv]), ...B.map((lv) => ['B', lv])];
  let a = 0, pairs = 0;
  for (let seed = 1; seed <= N; seed++) {
    const pts = field.map(() => 0);
    for (let n = 1; n <= R; n++) {
      const order = seasonRace(field, { ...opts, races: R, race: n, seed });
      order.forEach((i, p) => { pts[i] += PTS[p] != null ? PTS[p] : 1; });
    }
    for (let i = 0; i < A.length; i++) for (let j = A.length; j < field.length; j++) { a += pts[i] > pts[j] ? 1 : pts[i] === pts[j] ? 0.5 : 0; pairs++; }
  }
  return a / pairs;
}
// One race of a season: the plan comes from the season's seed, the luck from the race number.
function seasonRace(field, opts) {
  const room = fakeRoom(opts.seed);
  const g = def.create(room, { ...def.defaults, weather: false, races: opts.races, terrain: opts.terrain || 'mixed', course: opts.course || 'classic' });
  let c; for (let n = 1; n <= opts.race; n++) { c = g.newCourse(n); g.course = c; }
  g.race = opts.race - 1;
  field.forEach(([label, lv], i) => g.ducks.set('d' + i, duckWith(lv)));
  const { entries } = g.simulate();
  return entries.filter((e) => /^d\d/.test(e.id)).sort((x, y) => x.time - y.time).map((e) => +e.id.slice(1));
}
// Every planned season (seeds 1..N): how many times each skill is featured (c[k]), each skill's
// share of the season (share[k]: its part of every race's course, counted from the sections that
// were really built, a combined section half to each skill, a Stamina race's late race and a trek to
// Stamina), how many skills each race features (counts) and the worlds (themes).
function seasonSpread(races, terrain = 'mixed', N = 50) {
  const out = [];
  for (let seed = 1; seed <= N; seed++) {
    const g = def.create(fakeRoom(seed), { ...def.defaults, races, terrain });
    const c = Object.fromEntries(SK.map((k) => [k, 0])), share = Object.fromEntries(SK.map((k) => [k, 0])), counts = [], themes = [], courses = [];
    for (let n = 1; n <= races; n++) {
      const C = g.newCourse(n); g.course = C; courses.push(C);
      for (const k of C.featured) c[k]++;
      if (n < races) counts.push(C.featured.length);
      themes.push(C.theme);
      const sh = courseShares(C); for (const k of SK) share[k] += sh[k];
    }
    out.push({ ...c, c, share, counts, themes, courses });
  }
  return out;
}
// A course's share per skill (sums to 1): each section's time at level 0 (a combined section half to
// each skill), and Stamina one more share when featured (the long late race). A trek is all Stamina.
function courseShares(C) {
  const o = Object.fromEntries(SK.map((k) => [k, 0]));
  if (C.trek) { o.stamina = 1; return o; }
  let tot = 0;
  for (const s of C.sections) {
    const S = D.SECTIONS[s.type], t = C.secLen[s.type] / S.v0 * (s.type === 'cliff' ? 1 + D.WALL.share * (1 / D.WALL.speed - 1) : 1);
    if (s.mix) { o[S.skill] += t / 2; o[s.mix] += t / 2; } else o[S.skill] += t; tot += t;
  }
  const st = C.featured.includes('stamina') ? 1 / C.featured.length : 0;
  for (const k of SK) o[k] = (o[k] / tot) * (1 - st);
  o.stamina += st;
  return o;
}
// Single-skill races of skill k: N of them (from seed 1 on), field A against field B; returns the
// share of races a duck of B wins outright, and the share of A-vs-B pairs B finishes ahead in.
function soloRaces(k, A, B, N = 40, opts = {}) {
  let wins = 0, b = 0, pairs = 0, seed = 1;
  const field = [...A.map((lv) => ['A', lv]), ...B.map((lv) => ['B', lv])];
  for (let i = 0; i < N; i++) {
    const r = courseFor({ ...opts, solo: k, seed }), g = r.g; seed = r.seed + 1;
    field.forEach(([label, lv], j) => g.ducks.set(label + '#' + j, duckWith(lv)));
    const order = g.simulate().entries.filter((e) => /#/.test(e.id)).sort((x, y) => x.time - y.time).map((e) => e.id[0]);
    if (order[0] === 'B') wins++;
    let bSeen = 0; for (const x of order) { if (x === 'B') bSeen++; else { b += bSeen; pairs += B.length; } }
  }
  return { wins: wins / N, pairs: b / pairs };
}
// The boss race: the best player duck (levels best) and the rest of the field (others), against the
// Golden Goose in the Grand Championship. Returns how often a player duck finishes ahead of it.
function bossOdds(best, others = [], N = 200, opts = {}) {
  let beat = 0;
  for (let seed = 1; seed <= N; seed++) {
    const room = fakeRoom(seed), g = def.create(room, { ...def.defaults, weather: !!opts.weather, boss: true, races: 5, terrain: 'mixed' });
    for (let n = 1; n <= 5; n++) { g.course = g.newCourse(n); } g.race = 4;
    [best, ...others].forEach((lv, i) => g.ducks.set('p' + i, duckWith(lv)));
    const order = g.simulate().entries.sort((a, b) => a.time - b.time).map((e) => e.id);
    if (order.findIndex((id) => /^p/.test(id)) < order.indexOf('boss')) beat++;
  }
  return beat / N;
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

module.exports = { race, courseFor, courseShares, soloRaces, bossOdds, oneRaised, headToHead, seasonHeadToHead, seasonSpread, specialist, lopsided, missing, even, plus, duckWith, SK };

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
  console.log('\n(b) balanced vs specialist with the same total: the share of match-ups the balanced duck wins,');
  console.log('    per race / over a whole 5-race season (season points)');
  console.log('total   vs         ' + SK.map((k) => k.padStart(12)).join(''));
  const S = Math.max(20, Math.round(N / 5));
  for (const total of [12, 30, 60]) for (const [name, f] of [['all-in', specialist], ['half-in', lopsided]]) {
    if (total === 60 && name === 'half-in') continue; // the same ducks as all-in (capped at level 25)
    const E = even(total / 6), row = SK.map((k) => pct(headToHead([E, E, E], [f(total, k), f(total, k), f(total, k)], {}, Math.round(N / 2))) + '/' + pct(seasonHeadToHead([E, E, E], [f(total, k), f(total, k), f(total, k)], {}, S)));
    console.log(`${String(total).padEnd(7)} ${name.padEnd(10)} ` + row.map((v) => v.padStart(12)).join(''));
  }
  console.log('\n(c) balanced vs "all but one" (that skill at 0, the same total): per race / per season');
  console.log('level   ' + SK.map((k) => ('no ' + k).padStart(12)).join(''));
  for (const L of [2, 5, 10]) {
    const E = even(L), row = SK.map((k) => pct(headToHead([E, E, E], [missing(L, k), missing(L, k), missing(L, k)], {}, Math.round(N / 2))) + '/' + pct(seasonHeadToHead([E, E, E], [missing(L, k), missing(L, k), missing(L, k)], {}, S)));
    console.log(`L${String(L).padEnd(6)} ` + row.map((v) => v.padStart(12)).join(''));
  }
  console.log('\n(d) every world (Everything terrain, L5+4): win share per raised skill (each world favours its own skills)');
  console.log('         ' + SK.map((k) => k.padStart(8)).join('') + '   theme weights (D.THEMES[k].skills)');
  for (const theme of Object.keys(D.THEMES)) {
    const r = oneRaised(5, 4, { theme }, Math.round(N / 2)), S = D.THEMES[theme].skills;
    console.log(`${theme.padEnd(9)}` + SK.map((k) => pct(r[k]).padStart(8)).join('') + '   ' + SK.map((k) => S[k]).join(' '));
  }
  console.log('\n(e) seasons (300 planned seasons each): each skill\'s share of the whole season (sections really built,');
  console.log('    combined sections half each), min-max over the seasons; how many skills a race features (non-final races)');
  for (const terrain of ['mixed', 'classic', 'brainy']) for (const races of [3, 5, 8, 10]) {
    const sp = seasonSpread(races, terrain, 300), sk = terrain === 'classic' ? SK.filter((k) => k !== 'smarts') : SK;
    const cnt = [0, 0, 0, 0, 0, 0, 0]; for (const s of sp) for (const n of s.counts) cnt[n]++; const tot = cnt.reduce((a, b) => a + b, 0);
    const avg = (k) => sp.reduce((a, s) => a + s.share[k], 0) / sp.length / races;
    const missed = sp.filter((s) => sk.some((k) => s.courses.slice(0, -1).every((C) => !C.featured.includes(k)))).length;
    console.log(`${terrain.padEnd(8)} ${String(races).padStart(2)} races  avg ` + sk.map((k) => `${k} ${pct(avg(k)).trim()}`).join(' ') + `  | 1-6 skills: ` + cnt.slice(1).map((c) => pct(c / tot).trim()).join(' ') + (races >= 4 ? `  | seasons with a skill never featured before the final: ${missed}` : ''));
  }
  console.log('\n(f) single-skill races: 3 balanced ducks (all L5) vs 3 specialists (total 30, half or all of it in that skill):');
  console.log('    how often a specialist wins / the share of match-ups the specialist wins');
  for (const k of SK) {
    const E = even(5), h = soloRaces(k, [E, E, E], [lopsided(30, k), lopsided(30, k), lopsided(30, k)], 40), a = soloRaces(k, [E, E, E], [specialist(30, k), specialist(30, k), specialist(30, k)], 40);
    console.log(`${k.padEnd(8)} half-in ${pct(h.wins)} / ${pct(h.pairs)}    all-in ${pct(a.wins)} / ${pct(a.pairs)}`);
  }
  console.log('\n(g) boss race: how often a player duck beats the Golden Goose (best duck at level L, two weaker ducks)');
  const typ = (L) => ({ run: L + 2, swim: L - 1, fly: L, climb: L + 1, stamina: L - 2, smarts: L });
  for (const L of [4, 8, 12]) console.log(`L${String(L).padEnd(3)} even ${pct(bossOdds(even(L), [even(L - 2), even(L - 3)], N))}   uneven ${pct(bossOdds(typ(L), [typ(L - 2)], N))}   alone ${pct(bossOdds(even(L), [], N))}`);
  console.log(`\n${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
