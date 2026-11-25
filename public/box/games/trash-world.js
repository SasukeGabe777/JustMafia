'use strict';
// JustZombies: the shared world rules (the server, the TV and the phones all load this file).
// - the grid of areas (GRID x GRID cells), each cell's look (biome) and layout generated from the
//   room seed, so every phone and the TV build exactly the same area from (seed, x, y);
// - the abilities you pick on level-up (Attack / Defense / Special), the pickups, the zombie
//   types and the wave curve.
// Node: module.exports; browser: window.TZW.
(function (root, factory) {
  const M = factory();
  if (typeof module === 'object' && module.exports) module.exports = M; else root.TZW = M;
})(typeof self !== 'undefined' ? self : this, function () {
  const GRID = 9, AW = 1600, AH = 960, TILE = 80, TW = AW / TILE, TH = AH / TILE;

  function hash() {
    let h = 2166136261;
    for (let a = 0; a < arguments.length; a++) { const s = String(arguments[a]); for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; h = Math.imul(h ^ 47, 16777619) >>> 0; }
    return h >>> 0;
  }
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const pick = (r, list) => list[Math.floor(r() * list.length)];

  // ---------------- the looks (districts) ----------------
  // ground: lot colours (minimap + art); lot: how the open ground off the road is drawn
  // (public/box/games/trash-art.js); bld: [min, max] buildings, their size range in tiles and roof
  // style; props: the junk that blocks you (and bullets); edge: fence colour.
  const BIOMES = [
    { key: 'junkyard', name: 'Junkyard', icon: '🛞', ground: ['#6b5a43', '#5c4c37'], lot: 'dirt', edge: '#3b2f22', accent: '#d9a441', bld: [0, 1, [2, 3], [2, 2], 'shack'], props: ['wreck', 'tires', 'trash', 'container', 'barrel', 'fridge', 'wreck', 'stack'] },
    { key: 'suburb', name: 'Suburb Street', icon: '🏡', ground: ['#4f7a3e', '#466e36'], lot: 'lawn', edge: '#2f5a28', accent: '#ffd23f', bld: [2, 3, [3, 4], [2, 3], 'house'], props: ['car', 'bin', 'hedge', 'tree', 'mailbox', 'car', 'tree'] },
    { key: 'lot', name: 'Parking Lot', icon: '🅿️', ground: ['#3f434a', '#383c43'], lot: 'parking', edge: '#22252a', accent: '#f2f2f2', bld: [0, 1, [2, 2], [2, 2], 'kiosk'], props: ['car', 'car', 'cart', 'wreck', 'car', 'lamp', 'barrier'] },
    { key: 'gas', name: 'Gas Station', icon: '⛽', ground: ['#7c7a73', '#6f6d66'], lot: 'slabs', edge: '#3a3833', accent: '#ff5a3c', bld: [1, 1, [3, 4], [2, 2], 'store'], props: ['pump', 'pump', 'car', 'barrel', 'tires', 'dumpster'] },
    { key: 'mall', name: 'Dead Mall', icon: '🛍️', ground: ['#8c8678', '#7d776a'], lot: 'plaza', edge: '#5d5446', accent: '#ff6fb5', bld: [1, 2, [5, 7], [3, 3], 'mall'], props: ['planter', 'bench', 'cart', 'car', 'lamp', 'dumpster'] },
    { key: 'park', name: 'Overgrown Park', icon: '🌳', ground: ['#4e7b3b', '#45702f'], lot: 'grass', edge: '#2a4a1d', accent: '#ffe066', bld: [0, 1, [2, 2], [1, 2], 'shack'], props: ['tree', 'tree', 'bench', 'bush', 'fountain', 'tree', 'pond'] },
    { key: 'roof', name: 'Downtown', icon: '🏙️', ground: ['#77736b', '#6a665e'], lot: 'plaza', edge: '#2b3036', accent: '#7fd6ff', bld: [2, 3, [3, 5], [2, 3], 'tower'], props: ['dumpster', 'crate', 'hydrant', 'car', 'lamp', 'bags'] },
    { key: 'sewer', name: 'Sewer Works', icon: '🕳️', ground: ['#5b625a', '#4e554d'], lot: 'canal', edge: '#1d241f', accent: '#9cff5a', bld: [1, 1, [3, 3], [2, 2], 'plant'], props: ['pipe', 'barrel', 'crate', 'pipe', 'grate', 'tank'] },
    { key: 'carnival', name: 'Busted Carnival', icon: '🎪', ground: ['#6a5a4a', '#5c4e40'], lot: 'fair', edge: '#3a1f33', accent: '#ffd23f', bld: [0, 1, [3, 3], [2, 2], 'tent'], props: ['booth', 'barrel', 'crate', 'booth', 'balloons', 'lamp'] },
    { key: 'school', name: 'Shut School', icon: '🏫', ground: ['#4b7a3c', '#55504a'], lot: 'yard', edge: '#4a3520', accent: '#3ec1ff', bld: [1, 1, [6, 7], [2, 3], 'school'], props: ['bench', 'tree', 'bin', 'picnic', 'bus', 'tree'] },
    { key: 'docks', name: 'Rusty Docks', icon: '⚓', ground: ['#6b5035', '#5d452c'], lot: 'docks', edge: '#1f4a63', accent: '#ff8c42', bld: [1, 2, [4, 5], [2, 3], 'warehouse'], props: ['container', 'crate', 'barrel', 'rope', 'crate', 'container'] },
    { key: 'landfill', name: 'Landfill Hills', icon: '🗑️', ground: ['#6c6a3d', '#5f5d33'], lot: 'dirt', edge: '#3a3820', accent: '#c8ff3c', bld: [0, 0, [1, 1], [1, 1], 'shack'], props: ['trash', 'trash', 'tires', 'bags', 'fridge', 'mound', 'mound'] },
  ];
  // The wild realms around the town (every map is a mix: a few city blocks, the rest country, frozen and
  // volcano land). realm: which; road: how its roads look (dirt, packed snow, basalt); lava / ice / lake:
  // hazards on the ground (genArea: hazards); special: the realm's big kill-locked block (trash-story locks()).
  const WILD = [
    { key: 'farm', realm: 'country', name: 'Old Farm', icon: '🚜', ground: ['#7d9a44', '#728f3e'], lot: 'farm', edge: '#5a4428', accent: '#ffd23f', road: 'dirt', bld: [1, 1, [4, 5], [3, 3], 'barn'], props: ['haybale', 'haybale', 'corn', 'corn', 'fencefarm', 'scarecrow', 'tractor', 'silo', 'wheat', 'wheat'] },
    { key: 'fields', realm: 'country', name: 'Cornfields', icon: '🌽', ground: ['#8fa040', '#84953a'], lot: 'field', edge: '#5a4428', accent: '#ffe066', road: 'dirt', bld: [0, 1, [3, 4], [2, 3], 'barn'], props: ['corn', 'corn', 'corn', 'corn', 'corn', 'haybale', 'scarecrow', 'wheat', 'wheat', 'fencefarm'], corn: true },
    { key: 'snow', realm: 'frozen', name: 'Snowy Woods', icon: '🌲', ground: ['#e9eff6', '#dfe7f0'], lot: 'snow', edge: '#9fb3c8', accent: '#7fd6ff', road: 'snow', bld: [0, 1, [2, 3], [2, 2], 'cabin'], props: ['snowpine', 'snowpine', 'snowpine2', 'snowpine2', 'snowrock', 'logs', 'tent', 'campfire', 'icechunk'], ice: 1 },
    { key: 'icelake', realm: 'frozen', name: 'Frozen Lake', icon: '🧊', ground: ['#dde9f3', '#d2e1ee'], lot: 'snow', edge: '#9fb3c8', accent: '#7fd6ff', road: 'snow', bld: [0, 1, [2, 3], [2, 2], 'cabin'], props: ['snowpine', 'snowpine2', 'snowrock', 'icechunk', 'icechunk', 'logs'], lake: true },
    { key: 'lodge', realm: 'frozen', name: 'Ski Lodge', icon: '⛷️', ground: ['#e9eff6', '#dfe7f0'], lot: 'snow', edge: '#9fb3c8', accent: '#ff7a5a', road: 'snow', bld: [1, 1, [5, 6], [3, 4], 'lodge'], props: ['snowpine', 'snowpine2', 'tent', 'campfire', 'logs', 'snowrock'], ice: 1 },
    { key: 'ash', realm: 'volcano', name: 'Ash Flats', icon: '🌋', ground: ['#4d4748', '#454041'], lot: 'ash', edge: '#2a2224', accent: '#ff6a2a', road: 'basalt', bld: [0, 0, [1, 1], [1, 1], 'none'], props: ['lavarock', 'lavarock', 'basalt', 'basalt', 'vent', 'charred'], lava: 1 },
    { key: 'lavafield', realm: 'volcano', name: 'Lava Fields', icon: '🔥', ground: ['#433b3d', '#3b3335'], lot: 'ash', edge: '#2a2224', accent: '#ff4a1a', road: 'basalt', bld: [0, 0, [1, 1], [1, 1], 'none'], props: ['lavarock', 'basalt', 'vent', 'vent', 'charred', 'lavarock'], lava: 2 },
    { key: 'crater', realm: 'volcano', name: 'Volcano Crater', icon: '🌋', ground: ['#3d3537', '#352d2f'], lot: 'ash', edge: '#2a2224', accent: '#ff3a0a', road: 'basalt', bld: [1, 1, [6, 7], [4, 4], 'volcano'], props: ['lavarock', 'basalt', 'vent', 'charred'], lava: 1, special: 'crater' },
    { key: 'fortress', realm: 'frozen', name: 'Frozen Fortress', icon: '🏰', ground: ['#d6e6f2', '#cadcec'], lot: 'snow', edge: '#7f9ab4', accent: '#7fd6ff', road: 'snow', bld: [1, 2, [3, 4], [2, 3], 'lodge'], props: ['icechunk', 'icechunk', 'icechunk', 'snowrock', 'snowpine'], ice: 2, special: 'fortress' },
  ];
  const REALMS = { city: { name: 'Town', icon: '🏙️', color: '#7a7f86' }, country: { name: 'Countryside', icon: '🌾', color: '#8fa040' }, frozen: { name: 'The Frozen North', icon: '❄️', color: '#dfe9f3' }, volcano: { name: 'Volcano Land', icon: '🌋', color: '#5a3a34' } };
  const HOME = { key: 'home', name: 'Your Street', icon: '🏠', ground: ['#4f7a3e', '#466e36'], lot: 'lawn', edge: '#2f5a28', accent: '#ffd23f', bld: [1, 2, [3, 4], [2, 3], 'house'], props: ['bin', 'car', 'hedge', 'mailbox', 'tree', 'bin'] };
  // Props: size in tiles, round (collides a little smaller) or boxy.
  const PROPS = {
    car: { w: 2, h: 1, kind: 'car' }, wreck: { w: 2, h: 1 }, bus: { w: 3, h: 1 }, stack: { w: 2, h: 1 }, container: { w: 3, h: 1, kind: 'container' }, tires: { w: 1, h: 1, round: true }, trash: { w: 1, h: 1, round: true },
    barrel: { w: 1, h: 1, round: true }, fridge: { w: 1, h: 1 }, bin: { w: 1, h: 1, round: true }, hedge: { w: 2, h: 1 }, tree: { w: 1, h: 1, round: true },
    mailbox: { w: 1, h: 1, round: true }, cart: { w: 1, h: 1 }, barrier: { w: 2, h: 1 }, pump: { w: 1, h: 2 }, crate: { w: 1, h: 1 }, dumpster: { w: 2, h: 1 },
    bench: { w: 2, h: 1 }, planter: { w: 1, h: 1, round: true }, bush: { w: 1, h: 1, round: true }, fountain: { w: 2, h: 2, round: true }, pond: { w: 3, h: 2, round: true },
    tank: { w: 2, h: 2, round: true }, pipe: { w: 3, h: 1 }, grate: { w: 2, h: 1, low: true }, booth: { w: 2, h: 2 }, balloons: { w: 1, h: 1, round: true },
    picnic: { w: 2, h: 1 }, rope: { w: 1, h: 1, round: true }, bags: { w: 1, h: 1, round: true }, mound: { w: 2, h: 2, round: true }, lamp: { w: 1, h: 1, round: true, thin: true }, hydrant: { w: 1, h: 1, round: true, thin: true },
    // the wild realms (soft: you walk and shoot through it; tall corn hides the zombies in it)
    haybale: { w: 1, h: 1, round: true }, corn: { w: 1, h: 1, soft: true, hide: true }, wheat: { w: 1, h: 1, soft: true }, fencefarm: { w: 2, h: 1, thin: true }, scarecrow: { w: 1, h: 1, round: true, thin: true },
    tractor: { w: 2, h: 1 }, silo: { w: 2, h: 2, round: true }, snowpine: { w: 1, h: 1, round: true }, snowpine2: { w: 1, h: 1, round: true }, snowrock: { w: 1, h: 1, round: true }, logs: { w: 1, h: 1 },
    tent: { w: 2, h: 2 }, campfire: { w: 1, h: 1, round: true, low: true }, icechunk: { w: 1, h: 1, round: true }, lavarock: { w: 1, h: 1, round: true }, basalt: { w: 1, h: 1, round: true }, vent: { w: 1, h: 1, round: true, low: true }, charred: { w: 1, h: 1, round: true, thin: true },
  };
  const DIRS = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }, OPP = { n: 's', s: 'n', w: 'e', e: 'w' };
  const inGrid = (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < GRID && y < GRID;

  // ---------------- the town: one road network for the whole grid ----------------
  // Built once per seed: two main streets each way run straight across the town, a random
  // spanning tree of side streets links every block, plus a few loops. A road leaving a cell's
  // edge enters the neighbour at the same place with the same width (the edge stores it), so
  // the town reads as one place on the TV map and the phone minimap. Districts (the looks) are
  // big seeded patches (Voronoi), so a mall or a park can spill over into the next block. One
  // side of town is the river, another the highway (drawn outside the fence).
  const MAIN_W = 230, SIDE_W = 150, SW = 34; // road widths (asphalt) and the sidewalk on each side
  const towns = new Map();
  function town(seed) {
    seed = Number(seed) || 1;
    if (towns.has(seed)) return towns.get(seed);
    const r = rng(hash(seed, 'town')), N = GRID;
    const rows = [1 + Math.floor(r() * 3), 5 + Math.floor(r() * 3)], cols = [1 + Math.floor(r() * 3), 5 + Math.floor(r() * 3)];
    const rowP = rows.map(() => 330 + Math.round(r() * 300)), colP = cols.map(() => 460 + Math.round(r() * 680));
    const C = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const ci = cols.indexOf(x), ri = rows.indexOf(y);
      C.push({ x, y, hub: { x: ci >= 0 ? colP[ci] : 380 + Math.round(r() * 840), y: ri >= 0 ? rowP[ri] : 300 + Math.round(r() * 360) }, side: { n: null, s: null, w: null, e: null }, d: null, end: null });
    }
    const at = (x, y) => C[y * N + x];
    const par = C.map((_, i) => i), find = (i) => (par[i] === i ? i : (par[i] = find(par[i]))), join = (a, b) => { par[find(a)] = find(b); };
    const link = (a, dir, w, main, p, rr = r) => {
      const [dx, dy] = DIRS[dir], b = at(a.x + dx, a.y + dy);
      if (p == null) p = dir === 'e' || dir === 'w' ? (rr() < 0.5 ? a.hub.y : b.hub.y) : (rr() < 0.5 ? a.hub.x : b.hub.x);
      const road = { p, w, main: !!main };
      a.side[dir] = road; b.side[OPP[dir]] = road; join(a.y * N + a.x, b.y * N + b.x);
    };
    rows.forEach((y, i) => { for (let x = 0; x < N - 1; x++) link(at(x, y), 'e', MAIN_W, true, rowP[i]); });
    cols.forEach((x, i) => { for (let y = 0; y < N - 1; y++) link(at(x, y), 's', MAIN_W, true, colP[i]); });
    const edges = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { if (x < N - 1 && !at(x, y).side.e) edges.push([x, y, 'e']); if (y < N - 1 && !at(x, y).side.s) edges.push([x, y, 's']); }
    for (let i = edges.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [edges[i], edges[j]] = [edges[j], edges[i]]; }
    const rest = [];
    for (const [x, y, dir] of edges) { const a = at(x, y), [dx, dy] = DIRS[dir], b = at(x + dx, y + dy); if (find(a.y * N + a.x) !== find(b.y * N + b.x)) link(a, dir, SIDE_W, false); else rest.push([x, y, dir]); }
    for (const [x, y, dir] of rest) if (r() < 0.16) link(at(x, y), dir, SIDE_W, false);
    // No dead ends: more cross streets and loops (their own draw, so the districts below stay put),
    // then every block gets at least two roads (a way on that isn't the way you came in) and most
    // blocks three, so you can always push forward or sideways.
    const r2 = rng(hash(seed, 'cross')), deg = (c) => Object.values(c.side).filter(Boolean).length;
    const open = (c) => Object.keys(DIRS).filter((d) => !c.side[d] && inGrid(c.x + DIRS[d][0], c.y + DIRS[d][1]));
    for (const [x, y, dir] of rest) { const a = at(x, y); if (!a.side[dir] && r2() < 0.24) link(a, dir, SIDE_W, false, null, r2); }
    for (const want of [2, 3]) for (const c of C) {
      if (deg(c) >= want || (want === 3 && r2() < 0.3)) continue;
      const L = open(c).map((d) => [d, deg(at(c.x + DIRS[d][0], c.y + DIRS[d][1])) + r2()]).sort((a, b) => a[1] - b[1]);
      if (L.length) link(c, L[0][0], SIDE_W, false, null, r2);
    }
    for (const c of C) { const n = Object.values(c.side).filter(Boolean).length; c.n = n; if (n === 1) c.end = r() < 0.55 ? 'culdesac' : 'gate'; }
    // realms: the town is only a few blocks; the rest of the map is countryside, the frozen north and
    // volcano land (seeded patches, each realm at least a few blocks), then the districts inside each realm
    const rr = rng(hash(seed, 'realms')), dd = (c, s) => Math.hypot(c.x + 0.5 - s.x, c.y + 0.5 - s.y);
    for (let tries = 0; tries < 12; tries++) {
      const city = { x: 1 + rr() * (N - 2), y: 1 + rr() * (N - 2) }, nCity = 12 + Math.floor(rr() * 8);
      const order = C.map((c) => [c, dd(c, city) + rr() * 0.6]).sort((a, b) => a[1] - b[1]);
      order.forEach(([c], i) => { c.realm = i < nCity ? 'city' : null; });
      const rs = ['country', 'frozen', 'volcano', rr() < 0.5 ? 'country' : 'frozen'].map((k) => { let s; for (let j = 0; j < 30; j++) { s = { k, x: rr() * N, y: rr() * N }; if (dd(s, city) > 2.6) break; } return s; });
      for (const c of C) if (!c.realm) { let best = null, bd = 1e9; for (const s of rs) { const d = dd(c, s) + rr() * 0.5; if (d < bd) { bd = d; best = s; } } c.realm = best.k; }
      const cnt = {}; for (const c of C) cnt[c.realm] = (cnt[c.realm] || 0) + 1;
      if (cnt.country >= 6 && cnt.frozen >= 6 && cnt.volcano >= 6) break;
    }
    const keys = BIOMES.map((b) => b.key).concat(['suburb', 'suburb', 'roof', 'lot', 'park']);
    const seeds = keys.map((k) => ({ k, x: r() * N, y: r() * N }));
    const wildSeeds = { country: ['farm', 'fields', 'farm', 'fields'], frozen: ['snow', 'icelake', 'lodge', 'snow'], volcano: ['ash', 'lavafield', 'ash'] };
    const ws = Object.entries(wildSeeds).flatMap(([realm, L]) => L.map((k) => ({ k, realm, x: rr() * N, y: rr() * N })));
    for (const c of C) { let best = null, bd = 1e9; const L = c.realm === 'city' ? seeds : ws.filter((s) => s.realm === c.realm); for (const s of L) { const d = Math.hypot(c.x + 0.5 - s.x, c.y + 0.5 - s.y) + r() * 0.35; if (d < bd) { bd = d; best = s; } } c.d = best.k; }
    // each wild realm's big special block (a volcano crater, a frozen fortress): the block of that realm farthest from town
    for (const [realm, k] of [['volcano', 'crater'], ['frozen', 'fortress']]) { let best = null, bd = -1; for (const c of C) { if (c.realm !== realm || Object.values(c.side).filter(Boolean).length < 2) continue; const d = C.filter((q) => q.realm === 'city').reduce((m, q) => Math.min(m, Math.abs(q.x - c.x) + Math.abs(q.y - c.y)), 99) + rr() * 0.5; if (d > bd) { bd = d; best = c; } } if (best) best.d = k; }
    const sides = ['n', 's', 'w', 'e'], river = sides[Math.floor(r() * 4)], highway = sides.filter((s) => s !== river)[Math.floor(r() * 3)];
    const T = { seed, N, cells: C, rows, cols, river, highway };
    if (towns.size > 16) towns.clear();
    towns.set(seed, T); return T;
  }
  const cellOf = (seed, x, y) => (inGrid(x, y) ? town(seed).cells[y * GRID + x] : null);
  // Is there a road from cell a to the neighbouring cell b? (the only way between areas)
  function roadBetween(seed, a, b) {
    if (!a || !b || !inGrid(a[0], a[1]) || !inGrid(b[0], b[1])) return false;
    const dx = b[0] - a[0], dy = b[1] - a[1]; if (Math.abs(dx) + Math.abs(dy) !== 1) return false;
    const dir = dx === 1 ? 'e' : dx === -1 ? 'w' : dy === 1 ? 's' : 'n';
    return !!cellOf(seed, a[0], a[1]).side[dir];
  }
  // Road steps between cells (breadth first from the given cells).
  function roadDist(seed, from) {
    const N = GRID, d = new Array(N * N).fill(Infinity), q = [];
    for (const f of from) if (inGrid(f[0], f[1])) { d[f[1] * N + f[0]] = 0; q.push(f); }
    while (q.length) { const [x, y] = q.shift(), c = cellOf(seed, x, y); for (const dir of ['n', 's', 'w', 'e']) if (c.side[dir]) { const nx = x + DIRS[dir][0], ny = y + DIRS[dir][1], i = ny * N + nx; if (d[i] > d[y * N + x] + 1) { d[i] = d[y * N + x] + 1; q.push([nx, ny]); } } }
    return d;
  }
  for (const b of BIOMES) b.realm = b.realm || 'city';
  const byKey = Object.fromEntries(BIOMES.concat(WILD).map((b) => [b.key, b]));
  const realmOf = (seed, x, y) => { const c = cellOf(seed, x, y); return (c && c.realm) || 'city'; };
  function biomeOf(seed, x, y, homes) {
    if (homes && homes.some((h) => h[0] === x && h[1] === y)) return HOME;
    const c = cellOf(seed, x, y); return (c && byKey[c.d]) || BIOMES[0];
  }
  // A cell's exits: { n: { p, w } | null, ... } where the roads cross its edges.
  const exitsOf = (seed, x, y) => { const c = cellOf(seed, x, y); return c ? { n: c.side.n, s: c.side.s, w: c.side.w, e: c.side.e } : { n: null, s: null, w: null, e: null }; };
  // The road pieces inside a cell as boxes (asphalt): from each edge crossing to the junction.
  function roadRects(c) {
    const R = [], h = c.hub;
    for (const dir of ['n', 's', 'w', 'e']) {
      const s = c.side[dir]; if (!s) continue; const w = s.w, hw = w / 2;
      if (dir === 'n' || dir === 's') {
        const y0 = dir === 'n' ? -60 : Math.min(h.y, AH), y1 = dir === 'n' ? h.y : AH + 60;
        R.push({ x: s.p - hw, y: Math.min(y0, y1) - (dir === 's' ? hw : 0), w, h: Math.abs(y1 - y0) + hw, dir, main: s.main });
        if (Math.abs(s.p - h.x) > 2) R.push({ x: Math.min(s.p, h.x) - hw, y: h.y - hw, w: Math.abs(s.p - h.x) + w, h: w, dir, main: s.main, bend: true });
      } else {
        const x0 = dir === 'w' ? -60 : h.x, x1 = dir === 'w' ? h.x : AW + 60;
        R.push({ x: Math.min(x0, x1) - (dir === 'e' ? hw : 0), y: s.p - hw, w: Math.abs(x1 - x0) + hw, h: w, dir, main: s.main });
        if (Math.abs(s.p - h.y) > 2) R.push({ x: h.x - hw, y: Math.min(s.p, h.y) - hw, w, h: Math.abs(s.p - h.y) + w, dir, main: s.main, bend: true });
      }
    }
    return R;
  }
  // The garage you start in (home cells): placed by the street, door facing down.
  const GARAGE = { w: 6 * TILE, h: 3 * TILE, door: 4 * TILE, apron: 150 };
  const DOOR = { w: 300, h: 170 }; // the boss door / landmark spot

  // An area's layout from (seed, x, y): its roads (from the town), buildings and props that keep
  // off the roads and sidewalks, a landmark spot by the road (finds, the boss door, shops) and,
  // in a home cell, the garage. Obstacles are axis-aligned boxes.
  function genArea(seed, x, y, home) {
    const r = rng(hash(seed, 'area', x, y)), T = town(seed), c = cellOf(seed, x, y) || T.cells[0];
    const biome = home ? HOME : biomeOf(seed, x, y);
    const roads = roadRects(c), walks = roads.map((q) => ({ x: q.x - SW, y: q.y - SW, w: q.w + 2 * SW, h: q.h + 2 * SW }));
    const hits = (a, b, pad = 0) => a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
    const used = Array.from({ length: TH }, () => new Array(TW).fill(0));
    const mark = (q, v) => { for (let j = Math.max(0, Math.floor(q.y / TILE)); j < Math.min(TH, Math.ceil((q.y + q.h) / TILE)); j++) for (let i = Math.max(0, Math.floor(q.x / TILE)); i < Math.min(TW, Math.ceil((q.x + q.w) / TILE)); i++) used[j][i] = Math.max(used[j][i], v); };
    for (let i = 0; i < TW; i++) { used[0][i] = 2; used[TH - 1][i] = 2; } for (let j = 0; j < TH; j++) { used[j][0] = 2; used[j][TW - 1] = 2; }
    for (const q of walks) mark(q, 2);
    // a spot of open ground right by the road: the garage (home) or the landmark (finds, door, shop)
    const lot = (w, h, apron) => {
      let best = null, bs = Infinity;
      for (let ty = 0; ty <= TH; ty++) for (let tx = 1; tx < TW; tx++) {
        const q = { x: tx * TILE - (w % TILE) / 2, y: ty === 0 ? 0 : ty * TILE, w, h };
        if (q.x < TILE || q.x + w > AW - TILE || q.y + h + apron > AH - 20 || (q.y > 0 && q.y < TILE)) continue;
        if (walks.some((k) => hits(q, k))) continue;
        const ap = { x: q.x + w / 2 - 60, y: q.y + h, w: 120, h: apron };
        const touch = walks.some((k) => hits(ap, k, 4)) ? 0 : 400;
        const d = Math.hypot(q.x + w / 2 - c.hub.x, q.y + h - c.hub.y) * 0.4 + touch + (q.y === 0 ? -60 : 0) + r() * 30;
        if (d < bs) { bs = d; best = q; }
      }
      return best || { x: AW / 2 - w / 2 - (c.hub.x > AW / 2 ? 380 : -380), y: 0, w, h };
    };
    const obstacles = [];
    let garage = null, spot = null;
    if (home) {
      const q = lot(GARAGE.w, GARAGE.h, GARAGE.apron);
      garage = { x: q.x, y: q.y, w: GARAGE.w, h: GARAGE.h, door: { x: q.x + (GARAGE.w - GARAGE.door) / 2, w: GARAGE.door }, kind: 'garage' };
      mark({ x: q.x - TILE, y: q.y, w: q.w + 2 * TILE, h: q.h + GARAGE.apron }, 2);
      const G = garage;
      obstacles.push({ x: G.x, y: G.y, w: G.door.x - G.x, h: G.h, kind: 'wall' }, { x: G.door.x + G.door.w, y: G.y, w: G.x + G.w - G.door.x - G.door.w, h: G.h, kind: 'wall' });
      if (G.y > 0) obstacles.push({ x: G.door.x, y: G.y, w: G.door.w, h: 30, kind: 'wall', back: true });
    } else {
      const q = lot(DOOR.w + 40, DOOR.h, 110); spot = { x: q.x + 20, y: q.y, w: DOOR.w, h: DOOR.h };
      mark({ x: q.x, y: q.y, w: q.w, h: q.h + 100 }, 2);
    }
    // ground hazards: lava rivers (with gaps where the roads cross: rock bridges), ice sheets, the frozen lake
    const hazards = [];
    if (biome.lava) for (let n = 0; n < biome.lava; n++) {
      const vert = r() < 0.5, wdt = 70 + Math.floor(r() * 40), at0 = (vert ? AW : AH) * (0.22 + r() * 0.56), seg = [];
      for (let v = -40; v < (vert ? AH : AW) + 40; v += 40) { const off = Math.sin(v / 170 + n * 2 + r() * 0.2) * 70, q = vert ? { x: at0 + off - wdt / 2, y: v, w: wdt, h: 40 } : { x: v, y: at0 + off - wdt / 2, w: 40, h: wdt }; if (walks.some((k) => hits(q, k, 6)) || (spot && hits(q, spot, 40)) || (garage && hits(q, garage, 40))) continue; seg.push(q); }
      for (const q of seg) { hazards.push({ kind: 'lava', ...q, rv: n, cx: q.x + q.w / 2, cy: q.y + q.h / 2, ww: wdt }); mark(q, 2); }
    }
    if (biome.lake || biome.ice) {
      const n = biome.lake ? 1 : biome.ice;
      for (let k = 0; k < n; k++) { const w = biome.lake ? 560 + r() * 200 : 220 + r() * 160, h = biome.lake ? 340 + r() * 120 : 160 + r() * 100, x = TILE + r() * (AW - 2 * TILE - w), y = TILE + r() * (AH - 2 * TILE - h); hazards.push({ kind: 'ice', x, y, w, h }); if (biome.lake) mark({ x: x + 40, y: y + 40, w: w - 80, h: h - 80 }, 2); }
    }
    const free = (tx, ty, w, h, gap) => { for (let j = ty - gap; j < ty + h + gap; j++) for (let i = tx - gap; i < tx + w + gap; i++) { if (j < 0 || i < 0 || j >= TH || i >= TW) { if (j >= ty && j < ty + h && i >= tx && i < tx + w) return false; continue; } const u = used[j][i]; if (u === 1 || (u === 2 && j >= ty && j < ty + h && i >= tx && i < tx + w)) return false; } return true; };
    // buildings first (big), then props
    const [bmin, bmax, [bw0, bw1], [bh0, bh1], style] = biome.bld;
    const nb = bmin + Math.floor(r() * (bmax - bmin + 1));
    for (let k = 0, tries = 0; k < nb && tries < 200; tries++) {
      const w = bw0 + Math.floor(r() * (bw1 - bw0 + 1)), h = bh0 + Math.floor(r() * (bh1 - bh0 + 1));
      const tx = 1 + Math.floor(r() * (TW - w - 1)), ty = 1 + Math.floor(r() * (TH - h - 1));
      if (!free(tx, ty, w, h, 1)) continue;
      mark({ x: tx * TILE, y: ty * TILE, w: w * TILE, h: h * TILE }, 1); k++;
      obstacles.push({ x: tx * TILE + 6, y: ty * TILE + 6, w: w * TILE - 12, h: h * TILE - 12, kind: 'bld', style, v: Math.floor(r() * 4), seed: Math.floor(r() * 1e6) });
    }
    const want = 8 + Math.floor(r() * 6);
    const soft = []; let placed = 0; // (soft: corn and wheat you walk and shoot through; kept apart from the obstacles)
    for (let tries = 0; tries < 320 && placed < want; tries++) {
      const kind = pick(r, biome.props), P = PROPS[kind];
      if (P.soft && soft.length >= 24) continue; // (enough corn: leave room for cover)
      const rot = !P.round && P.w !== P.h && r() < 0.35;
      const w = rot ? P.h : P.w, h = rot ? P.w : P.h;
      const tx = 1 + Math.floor(r() * (TW - w - 1)), ty = 1 + Math.floor(r() * (TH - h - 1));
      if (!free(tx, ty, w, h, P.soft ? 0 : 1)) continue;
      mark({ x: tx * TILE, y: ty * TILE, w: w * TILE, h: h * TILE }, 1);
      const pad = P.thin ? 28 : P.round ? 10 : 6;
      (P.soft ? soft : obstacles).push({ x: tx * TILE + pad, y: ty * TILE + pad, w: w * TILE - pad * 2, h: h * TILE - pad * 2, kind, round: !!P.round, low: !!P.low, soft: !!P.soft, hide: !!P.hide, rot, v: Math.floor(r() * 4), seed: Math.floor(r() * 1e6) }); placed += P.soft ? 0.4 : 1;
      if (kind === 'corn') for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 0], [2, 0], [0, 2]].slice(0, biome.corn ? 6 : 3)) { const ax = tx + dx, ay = ty + dy; if (ax < 1 || ay < 1 || ax >= TW - 1 || ay >= TH - 1 || !free(ax, ay, 1, 1, 0)) continue; mark({ x: ax * TILE, y: ay * TILE, w: TILE, h: TILE }, 1); soft.push({ x: ax * TILE + 6, y: ay * TILE + 6, w: TILE - 12, h: TILE - 12, kind: 'corn', soft: true, hide: true, v: Math.floor(r() * 4), seed: Math.floor(r() * 1e6) }); } // (a patch, not a stalk)
    }
    // always some real cover (the fields can fill up with corn)
    const hardKinds = biome.props.filter((k) => !PROPS[k].soft);
    for (let tries = 0; tries < 300 && hardKinds.length && obstacles.filter((o) => o.kind !== 'wall').length < 4; tries++) {
      const kind = pick(r, hardKinds), P = PROPS[kind], w = P.w, h = P.h, tx = 1 + Math.floor(r() * (TW - w - 1)), ty = 1 + Math.floor(r() * (TH - h - 1));
      if (!free(tx, ty, w, h, 0)) continue; mark({ x: tx * TILE, y: ty * TILE, w: w * TILE, h: h * TILE }, 1); const pad = P.thin ? 28 : P.round ? 10 : 6;
      obstacles.push({ x: tx * TILE + pad, y: ty * TILE + pad, w: w * TILE - pad * 2, h: h * TILE - pad * 2, kind, round: !!P.round, low: !!P.low, rot: false, v: Math.floor(r() * 4), seed: Math.floor(r() * 1e6) });
    }
    // parked cars and wrecks on the side streets (never blocking: they sit on the sidewalk line)
    const decals = [];
    const nd = 34 + Math.floor(r() * 20);
    for (let i = 0; i < nd; i++) decals.push({ x: r() * AW, y: r() * AH, k: Math.floor(r() * 8), s: 0.6 + r() * 0.9, a: r() * Math.PI * 2 });
    const exits = exitsOf(seed, x, y);
    return { x, y, seed, biome, realm: home ? 'city' : c.realm || 'city', obstacles, decals, garage, spot, home: !!home, exits, roads, hub: { ...c.hub }, end: c.end, cell: c, hazards, soft, town: { river: T.river, highway: T.highway } };
  }
  // Where you arrive from a direction (on the road, just inside the edge).
  function arrival(area, from) {
    const s = area.exits[from === 'n' ? 's' : from === 's' ? 'n' : from === 'w' ? 'e' : 'w'];
    if (from === 'n') return { x: s ? s.p : AW / 2, y: AH - 40 }; if (from === 's') return { x: s ? s.p : AW / 2, y: 40 };
    if (from === 'w') return { x: AW - 40, y: s ? s.p : AH / 2 }; return { x: 40, y: s ? s.p : AH / 2 };
  }

  // Spawn cells for runs: far from everybody else (players take turns around the grid).
  const SPOTS = [[4, 4], [1, 1], [7, 7], [1, 7], [7, 1], [4, 1], [4, 7], [1, 4], [7, 4], [2, 2], [6, 6], [2, 6], [6, 2]];
  function spawnCell(seed, taken, salt = 0) {
    const off = hash(seed, 'spots', salt) % SPOTS.length;
    let best = null, bestD = -1;
    for (let k = 0; k < SPOTS.length; k++) {
      const c = SPOTS[(k + off) % SPOTS.length];
      const d = taken.length ? Math.min(...taken.map((t) => Math.abs(t[0] - c[0]) + Math.abs(t[1] - c[1]))) : 99;
      if (d > bestD) { bestD = d; best = c; }
      if (d >= 6) break;
    }
    return best.slice();
  }

  // ---------------- abilities ----------------
  // cat: atk | def | spc. No cap: every pick stacks one more (x2, x3, ...). Stats that would break
  // the game (fire rate, dodge, speed, cooldowns) use soft diminishing returns in the phone sim.
  const ABILITIES = [
    { id: 'rapid', cat: 'atk', icon: '⚡', name: 'Itchy Trigger', desc: 'Fire 18% faster.' },
    { id: 'mount', cat: 'atk', icon: '🔩', name: 'Gun Rack', desc: '+1 weapon slot: merge one more gun into yours (5 max).', max: 3 },
    { id: 'pierce', cat: 'atk', icon: '🍢', name: 'Skewer Rounds', desc: 'Bullets go through one more zombie.' },
    { id: 'spread', cat: 'atk', icon: '🔱', name: 'Scattershot', desc: 'One more bullet in every shot.' },
    { id: 'big', cat: 'atk', icon: '🥫', name: 'Chonky Slugs', desc: 'Bigger bullets, +25% damage.' },
    { id: 'bounce', cat: 'atk', icon: '🎱', name: 'Pinball Rounds', desc: 'Bullets bounce off walls once more.' },
    { id: 'crit', cat: 'atk', icon: '🪙', name: 'Lucky Penny', desc: '+10% chance of a triple-damage hit.' },
    { id: 'burn', cat: 'atk', icon: '🌶️', name: 'Hot Sauce Rounds', desc: 'Hits set zombies on fire.' },
    { id: 'rear', cat: 'atk', icon: '🔙', name: 'Tailpipe Gun', desc: 'A second gun fires behind you (then to the sides).' },
    { id: 'hp', cat: 'def', icon: '🥪', name: 'Extra Lunch', desc: '+25 max health, and heal 25.' },
    { id: 'regen', cat: 'def', icon: '🍕', name: 'Leftover Pizza', desc: 'Heal 1 health every second.' },
    { id: 'plating', cat: 'def', icon: '🛡️', name: 'Hubcap Plating', desc: 'Take 10% less damage.' },
    { id: 'dodge', cat: 'def', icon: '🍌', name: 'Banana Reflexes', desc: '8% chance to dodge a hit.' },
    { id: 'thorns', cat: 'def', icon: '🌵', name: 'Rusty Spikes', desc: 'Zombies that touch you take 15 damage.' },
    { id: 'shove', cat: 'def', icon: '💨', name: 'Stink Cloud', desc: 'A stink blast shoves zombies back every few seconds.' },
    { id: 'life', cat: 'def', icon: '🍱', name: 'Spare Lunchbox', desc: 'An extra life: get back up once.' },
    { id: 'orbit', cat: 'spc', icon: '🛞', name: 'Hubcap Halo', desc: 'A hubcap spins around you, slicing zombies.' },
    { id: 'drone', cat: 'spc', icon: '🛸', name: 'Drone Buddy', desc: 'A little drone shoots the nearest zombie.' },
    { id: 'bomb', cat: 'spc', icon: '💣', name: 'Trash Bomb', desc: 'A garbage blast every few seconds (and on level up).' },
    { id: 'zap', cat: 'spc', icon: '🔌', name: 'Bug Zapper', desc: 'Lightning chains between nearby zombies.' },
    { id: 'magnet', cat: 'spc', icon: '🧲', name: 'Fridge Magnet', desc: 'Pull XP from 60% further away.' },
    { id: 'slow', cat: 'spc', icon: '🍯', name: 'Molasses Aura', desc: 'Zombies near you move 15% slower.' },
    { id: 'raccoon', cat: 'spc', icon: '🦝', name: 'Raccoon Pal', desc: 'A raccoon fights by your side.' },
    { id: 'kicks', cat: 'spc', icon: '👟', name: 'Fresh Kicks', desc: 'Run faster.' },
    { id: 'eagle', cat: 'spc', icon: '🦅', name: 'Eagle Eye', desc: 'See further around you (and a wider flashlight at night).' },
  ];
  const AB = Object.fromEntries(ABILITIES.map((a) => [a.id, a]));
  const CATS = { atk: { name: 'Attack', color: '#ff5a3c' }, def: { name: 'Defense', color: '#3ec1ff' }, spc: { name: 'Special', color: '#c37bff' } };
  // Three cards: one of each category (random within it). Nothing ever maxes out.
  function offer(r, owned) {
    owned = owned || {};
    const open = (c) => ABILITIES.filter((a) => a.cat === c && !(a.max && (owned[a.id] || 0) >= a.max)); // (a few abilities cap: the Gun Rack at 5 slots)
    const out = [];
    for (const c of ['atk', 'def', 'spc']) { const L = open(c); if (L.length) out.push(pick(r, L).id); }
    const rest = ABILITIES.filter((a) => !out.includes(a.id));
    while (out.length < 3 && rest.length) out.push(rest.splice(Math.floor(r() * rest.length), 1)[0].id);
    // shuffle so the categories don't always sit in the same slot
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
  }
  const levelsFromAbilities = (ab) => Object.values(ab || {}).reduce((s, n) => s + n, 0);

  // ---------------- pickups ----------------
  const PICKUPS = [
    { id: 'shield', icon: '🫧', name: 'Bubble Shield', dur: 8, color: '#6fe3ff', desc: 'Nothing can hurt you for 8 seconds.' },
    { id: 'armor', icon: '🗑️', name: 'Trash-Can Armor', dur: 0, color: '#b7c2cc', desc: 'Soaks up the next hit.' },
    { id: 'minigun', icon: '🔥', name: 'Buzzsaw Minigun', dur: 12, color: '#ffb02e', desc: '12 seconds of crazy-fast fire.' },
    { id: 'rockets', icon: '🚀', name: 'Rocket Barrage', dur: 8, color: '#ff5a3c', desc: '8 seconds of rockets flying at everything.' },
    { id: 'raygun', icon: '🛸', name: 'Ray Gun', dur: 10, color: '#7dff6a', desc: '10 seconds of green beams that go through everything.' },
    { id: 'truck', icon: '🚛', name: 'Garbage-Truck Ram', dur: 10, color: '#3d8a4a', desc: 'Drive a garbage truck through them for 10 seconds.' },
    { id: 'kicks', icon: '👟', name: 'Rocket Sneakers', dur: 10, color: '#7dff6a', desc: 'Run way faster for 10 seconds.' },
    { id: 'nuke', icon: '☢️', name: 'Garbage Day', dur: 0, color: '#c8ff3c', desc: 'Every zombie here gets taken out.' },
    { id: 'freeze', icon: '🧊', name: 'Freezer Burn', dur: 6, color: '#bfefff', desc: 'Zombies freeze solid for 6 seconds.' },
    { id: 'snack', icon: '🌭', name: 'Health Snack', dur: 0, color: '#ff7a8a', desc: 'Heal 35 health.' },
    { id: 'xp2', icon: '✨', name: 'Double XP', dur: 20, color: '#ffe066', desc: 'Twice the XP for 20 seconds.' },
    { id: 'scope', icon: '🔭', name: 'Lookout Binoculars', dur: 20, color: '#9fd8ff', desc: 'See way further for 20 seconds.' },
  ];
  const PK = Object.fromEntries(PICKUPS.map((p) => [p.id, p]));
  // a rare one, outside the usual drop table: the jetpack (trash-heli.js: 10 s of flight, then you float down)
  PK.jetpack = { id: 'jetpack', icon: '🎒', name: 'Jetpack', dur: 10, color: '#ff7a2a', rare: true, desc: 'Strap it on: fly over everything for 10 seconds (you can shoot), then float back down.' };

  // ---------------- zombies + waves ----------------
  const ZOMBIES = {
    walker: { name: 'Shambler', r: 19, hp: 20, speed: 70, dmg: 10, xp: 1, from: 1, w: 10 },
    runner: { name: 'Sprinter', r: 16, hp: 13, speed: 150, dmg: 8, xp: 1, from: 2, w: 5 },
    bloater: { name: 'Bloater', r: 29, hp: 55, speed: 48, dmg: 14, xp: 3, from: 3, w: 2, pops: true },
    canhead: { name: 'Can-Head', r: 22, hp: 80, speed: 62, dmg: 12, xp: 3, from: 4, w: 2, tough: true },
    spitter: { name: 'Spitter', r: 18, hp: 24, speed: 62, dmg: 9, xp: 2, from: 5, w: 2, spits: true },
    crawler: { name: 'Crawler', r: 15, hp: 14, speed: 165, dmg: 7, xp: 1, from: 4, w: 2.5, cap: 4 },
    exploder: { name: 'Gas-Bag', r: 20, hp: 26, speed: 120, dmg: 0, xp: 2, from: 5, w: 1.5, cap: 3, explodes: true },
    screamer: { name: 'Screamer', r: 18, hp: 32, speed: 60, dmg: 8, xp: 3, from: 6, w: 1, cap: 2, pulse: 'scream' },
    stalker: { name: 'Stalker', r: 17, hp: 22, speed: 135, dmg: 11, xp: 2, from: 8, w: 1.2, cap: 3 },
    brute: { name: 'Raging Brute', r: 30, hp: 170, speed: 50, dmg: 18, xp: 6, from: 9, w: 0.8, cap: 2, tough: true, rage: true },
    riot: { name: 'Riot Shield', r: 22, hp: 95, speed: 55, dmg: 12, xp: 4, from: 10, w: 0.8, cap: 2, shield: true },
    nest: { name: 'Rot Nest', r: 34, hp: 260, speed: 0, dmg: 0, xp: 8, from: 11, w: 0.3, cap: 0.6, nest: true },
    // debuff zombies (a coloured aura tells them apart; trash-fight.js does what they do to you)
    blinder: { name: 'Inkspitter', r: 19, hp: 34, speed: 62, dmg: 6, xp: 3, from: 7, w: 0.8, cap: 1.6, debuff: 'blind', aura: '#6a3a9a', ranged: true },
    webber: { name: 'Webber', r: 19, hp: 34, speed: 70, dmg: 6, xp: 3, from: 8, w: 0.8, cap: 1.6, debuff: 'web', aura: '#e8e8e8', ranged: true },
    jammer: { name: 'Gunk Jammer', r: 19, hp: 40, speed: 68, dmg: 8, xp: 3, from: 9, w: 0.7, cap: 1.4, debuff: 'jam', aura: '#9aa2aa' },
    sludger: { name: 'Sludger', r: 21, hp: 44, speed: 55, dmg: 8, xp: 3, from: 9, w: 0.7, cap: 1.4, debuff: 'sludge', aura: '#7ad03a', trail: true },
    squinter: { name: 'Squinter', r: 19, hp: 36, speed: 60, dmg: 6, xp: 3, from: 10, w: 0.6, cap: 1.2, debuff: 'zoom', aura: '#ffe066', pulse: 'flash' },
    confuser: { name: 'Spinner', r: 19, hp: 36, speed: 66, dmg: 6, xp: 3, from: 11, w: 0.6, cap: 1.2, debuff: 'confuse', aura: '#c37bff', pulse: 'spin' },
    leecher: { name: 'Leech', r: 18, hp: 30, speed: 90, dmg: 5, xp: 3, from: 12, w: 0.6, cap: 1.2, debuff: 'leech', aura: '#c0392b' },
    shaker: { name: 'Stomper', r: 26, hp: 90, speed: 48, dmg: 12, xp: 5, from: 12, w: 0.5, cap: 1, debuff: 'shake', aura: '#ff8c42', pulse: 'stomp' },
    boss: { name: 'Dumpster Brute', r: 56, hp: 650, speed: 52, dmg: 25, xp: 30, from: 99, w: 0, boss: true },
    // later boss waves bring a mini-boss that mixes the debuffs (trash-boss.js: art + patterns)
    spider: { name: 'Mother Webber', r: 58, hp: 900, speed: 60, dmg: 22, xp: 40, from: 99, w: 0, boss: true, mini: true },
    foghorn: { name: 'The Foghorn', r: 58, hp: 950, speed: 50, dmg: 22, xp: 40, from: 99, w: 0, boss: true, mini: true },
    toxic: { name: 'Toxic Tub', r: 62, hp: 1000, speed: 45, dmg: 24, xp: 40, from: 99, w: 0, boss: true, mini: true },
    icecream: { name: 'Mister Brain Freeze', r: 62, hp: 950, speed: 115, dmg: 24, xp: 40, from: 99, w: 0, boss: true, mini: true },
    compactor: { name: 'The Big Crunch', r: 64, hp: 1100, speed: 38, dmg: 28, xp: 40, from: 99, w: 0, boss: true, mini: true },
    final: { name: 'Final boss', r: 60, hp: 2500, speed: 60, dmg: 25, xp: 60, from: 99, w: 0, boss: true }, // Regular mode: the boss behind the door (trash-story.js)
  };
  function waveSpec(wave, players, diff) {
    const hard = diff === 'hard', n = Math.max(1, players || 1);
    const target = Math.round((10 + wave * 5) * (1 + 0.6 * (n - 1)) * (hard ? 1.15 : 1));
    return {
      wave, target, boss: wave % 5 === 0,
      every: Math.max(0.16, 1.05 - wave * 0.055) / Math.sqrt(n) / (hard ? 1.2 : 1), // seconds between spawns
      cap: Math.min(90, 16 + wave * 6 + (n - 1) * 10),
      hpMul: (1 + 0.13 * (wave - 1) + 0.004 * (wave - 1) * (wave - 1)) * (hard ? 1.35 : 1), speedMul: Math.min(1.5, 1 + 0.02 * (wave - 1)) * (hard ? 1.1 : 1), dmgMul: (1 + 0.05 * (wave - 1) + 0.001 * (wave - 1) * (wave - 1)) * (hard ? 1.3 : 1),
      weights: Object.entries(ZOMBIES).filter(([, z]) => z.from <= wave && z.w).map(([k, z]) => [k, k === 'walker' ? z.w : Math.min(z.cap || z.w + 6, z.w + (wave - z.from) * (z.cap ? 0.15 : 0.6))]),
      mini: wave >= 10 && wave % 5 === 0 ? ['spider', 'foghorn', 'toxic', 'icecream', 'compactor'][(wave / 5) % 5] : null,
    };
  }
  const xpNeed = (level) => Math.round(5 + level * 4 + Math.pow(level, 1.5));
  // The most a run can plausibly have (the server's loose sanity checks).
  const limits = { level: (kills) => 1 + Math.floor(Math.sqrt(kills * 3 + 4)) + 6, hp: (lvl) => 100 + 25 * Math.max(1, lvl) + 200 };
  // Soft cap: grows with n but never passes `top` (diminishing returns).
  const soft = (n, top, k) => top * (1 - Math.pow(k, n || 0));

  return { GRID, AW, AH, TILE, TW, TH, BIOMES, WILD, REALMS, realmOf, HOME, PROPS, DIRS, OPP, MAIN_W, SIDE_W, SW, town, cellOf, roadBetween, roadDist, roadRects, biomeOf, inGrid, exitsOf, genArea, arrival, GARAGE, DOOR, spawnCell, ABILITIES, AB, CATS, offer, levelsFromAbilities, PICKUPS, PK, ZOMBIES, waveSpec, xpNeed, limits, soft, hash, rng };
});
