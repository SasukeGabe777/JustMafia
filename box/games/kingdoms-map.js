'use strict';
// JustKingdoms map: axial hex math (pointy-top, q/r), world generation with fair starts placed
// in seating order, and BFS pathfinding around lakes and mountains.
const { TERRAIN, TERRAIN_WEIGHTS } = require('./kingdoms-data');

const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const dist = (aq, ar, bq, br) => (Math.abs(aq - bq) + Math.abs(ar - br) + Math.abs(aq + ar - bq - br)) / 2;
const key = (q, r) => q + ',' + r;
const passable = (t) => !!TERRAIN[t] && TERRAIN[t].pass;

// The ring of hexes at radius k around the centre, in angular order.
function ring(k) {
  if (k === 0) return [[0, 0]];
  const out = []; let q = DIRS[4][0] * k, r = DIRS[4][1] * k;
  for (let d = 0; d < 6; d++) for (let s = 0; s < k; s++) { out.push([q, r]); q += DIRS[d][0]; r += DIRS[d][1]; }
  return out;
}

// Map radius from the player count (§2), adjusted by the mapSize setting.
function radiusFor(n, size = 'auto') {
  let R = Math.max(3, Math.min(12, Math.round(2.2 + Math.sqrt(Math.max(1, n)) * 1.6)));
  if (size === 'small') R = Math.max(3, R - 1);
  if (size === 'large') R = Math.min(14, R + 2);
  while (homeSpots(n, R) == null) R++; // always room for everyone (small maps grow if needed)
  return R;
}

// Home tiles in seat order. One ring at round(R×0.68) (or the outer ring) when it fits with ≥3
// hexes between capitals; otherwise several rings 2 apart (spacing ≥2), filled outer → inner.
function homeSpots(n, R) {
  const r0 = Math.max(2, Math.round(R * 0.68));
  for (const k of [r0, R - 1]) {
    if (k >= 2 && 6 * k >= 3 * n) { const rg = ring(k); return Array.from({ length: n }, (_, i) => rg[Math.floor((i * rg.length) / n)]); }
  }
  const radii = []; for (let k = R - 1; k >= 3; k -= 2) radii.push(k);
  const cap = radii.map((k) => 3 * k), total = cap.reduce((a, b) => a + b, 0);
  if (total < n) return null;
  const counts = cap.map((c) => Math.floor((n * c) / total)); let left = n - counts.reduce((a, b) => a + b, 0);
  for (let i = 0; left > 0; i = (i + 1) % counts.length) if (counts[i] < cap[i]) { counts[i]++; left--; }
  const out = [];
  radii.forEach((k, j) => { const rg = ring(k), c = counts[j]; for (let i = 0; i < c; i++) out.push(rg[Math.floor((i * rg.length) / c)]); });
  return out;
}

class World {
  constructor(R) {
    this.R = R; this.tiles = []; this.index = new Map();
    for (let k = 0; k <= R; k++) for (const [q, r] of ring(k)) { const i = this.tiles.length; this.tiles.push({ i, q, r, t: 'p', o: null, v: 0, w: 0, units: {}, rich: false, cap: null }); this.index.set(key(q, r), i); }
    for (const T of this.tiles) T.nb = DIRS.map(([dq, dr]) => this.index.get(key(T.q + dq, T.r + dr))).filter((x) => x != null);
    this.prev = new Int32Array(this.tiles.length); this.seen = new Uint32Array(this.tiles.length); this.stamp = 0;
  }
  at(q, r) { const i = this.index.get(key(q, r)); return i == null ? null : this.tiles[i]; }
  dist(a, b) { const A = this.tiles[a], B = this.tiles[b]; return dist(A.q, A.r, B.q, B.r); }
  // Shortest path (BFS by hex count) through passable tiles; returns the tile indices after `from`
  // up to and including `to`, or null if unreachable.
  path(from, to) {
    if (from === to) return [];
    if (!passable(this.tiles[to].t)) return null;
    const st = ++this.stamp, prev = this.prev, seen = this.seen, q = [from]; seen[from] = st; prev[from] = -1;
    for (let h = 0; h < q.length; h++) {
      const c = q[h];
      for (const n of this.tiles[c].nb) {
        if (seen[n] === st || !passable(this.tiles[n].t)) continue;
        seen[n] = st; prev[n] = c;
        if (n === to) { const out = []; for (let x = to; x !== from; x = prev[x]) out.push(x); return out.reverse(); }
        q.push(n);
      }
    }
    return null;
  }
  // Every passable tile within `maxSteps` walking steps of `from` → Map(index → steps).
  reach(from, maxSteps) {
    const st = ++this.stamp, seen = this.seen, out = new Map([[from, 0]]), q = [from]; seen[from] = st;
    for (let h = 0; h < q.length; h++) {
      const c = q[h], d = out.get(c); if (d >= maxSteps) continue;
      for (const n of this.tiles[c].nb) { if (seen[n] === st || !passable(this.tiles[n].t)) continue; seen[n] = st; out.set(n, d + 1); q.push(n); }
    }
    return out;
  }
}

function pickTerrain(rng) {
  const tot = TERRAIN_WEIGHTS.reduce((a, [, w]) => a + w, 0); let x = rng() * tot;
  for (const [t, w] of TERRAIN_WEIGHTS) { x -= w; if (x <= 0) return t; }
  return 'p';
}
// Hex line (for carving a road through lakes/mountains so every capital is reachable).
function line(aq, ar, bq, br) {
  const n = dist(aq, ar, bq, br), out = [];
  for (let i = 0; i <= n; i++) {
    const t = n ? i / n : 0, x = aq + (bq - aq) * t + 1e-6, z = ar + (br - ar) * t + 1e-6, y = -x - z;
    let rx = Math.round(x), rz = Math.round(z); const ry = Math.round(y);
    const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
    if (dx > dy && dx > dz) rx = -ry - rz; else if (!(dy > dz)) rz = -rx - ry;
    out.push([rx, rz]);
  }
  return out;
}

// Build the world for n seats. Returns { world, homes: [tileIndex per seat] }.
function generate(n, rng, size = 'auto') {
  const R = radiusFor(n, size), W = new World(R), spots = homeSpots(n, R);
  for (const T of W.tiles) T.t = pickTerrain(rng);
  // Heartland: the centre holds the Ancient Ruins, its ring is rich (×2) and never impassable.
  for (const T of W.tiles) {
    const d = dist(T.q, T.r, 0, 0);
    if (d === 0) { T.t = 'r'; T.rich = true; } else if (d === 1) { T.rich = true; if (!passable(T.t)) T.t = ['p', 'f', 'h', 'g'][Math.floor(rng() * 4)]; }
  }
  const homes = spots.map(([q, r]) => W.index.get(key(q, r)));
  const isHome = new Set(homes);
  const share = new Map(); for (const h of homes) for (const nb of W.tiles[h].nb) share.set(nb, (share.get(nb) || 0) + 1);
  // Fair starts: a capital on plains, no impassable neighbour, at least one plains, forest and hills.
  for (let pass = 0; pass < 4; pass++) {
    let fixed = 0;
    for (const h of homes) {
      const H = W.tiles[h]; H.t = 'p'; H.rich = false;
      const nbs = H.nb.filter((x) => !isHome.has(x));
      for (const x of nbs) if (!passable(W.tiles[x].t) || W.tiles[x].t === 'r') { W.tiles[x].t = ['p', 'f', 'h'][Math.floor(rng() * 3)]; fixed++; }
      for (const need of ['p', 'f', 'h']) {
        if (nbs.some((x) => W.tiles[x].t === need)) continue;
        const cnt = (t) => nbs.filter((x) => W.tiles[x].t === t).length;
        // overwrite a private neighbour first, and only a terrain we have spare of
        const cand = nbs.slice().sort((a, b) => (share.get(a) || 0) - (share.get(b) || 0)).find((x) => { const t = W.tiles[x].t; return !['p', 'f', 'h'].includes(t) || cnt(t) > 1; });
        if (cand != null) { W.tiles[cand].t = need; fixed++; }
      }
    }
    if (!fixed) break;
  }
  // Connectivity: carve roads from unreachable capitals to the centre; seal any other pockets.
  const centre = W.index.get(key(0, 0));
  const reach = () => W.reach(centre, 1e9);
  let ok = reach();
  for (const h of homes) if (!ok.has(h)) { const H = W.tiles[h]; for (const [q, r] of line(H.q, H.r, 0, 0)) { const T = W.at(q, r); if (T && !passable(T.t)) T.t = 'p'; } ok = reach(); }
  for (const T of W.tiles) if (passable(T.t) && !ok.has(T.i)) T.t = 'm';
  return { world: W, homes };
}

module.exports = { DIRS, dist, key, ring, radiusFor, homeSpots, World, generate, passable, line };
