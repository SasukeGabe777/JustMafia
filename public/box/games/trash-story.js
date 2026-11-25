'use strict';
// JustZombies Regular mode (the story): gated areas, unique finds, the boss door and the bosses.
// Shared by the server, the TV and the phones (Node: module.exports; browser: window.TZS).
//   TZS.plan(seed, homes)  -> { tiers: [81 numbers], finds: { 'x,y': id }, door: [x, y], doorLook, boss }
//   TZS.need(tier, players) -> team kills for the radio's story beats (more players, more kills)
//   TZS.locks(seed, homes, o) -> the area locks (every mode): the team kills each block needs
// The plan is made once when the night starts (from the seed and the garages), so every screen
// agrees, and every night is different: the finds, the door's place and look, and the boss.
(function (root, factory) {
  // (the places come from trash-shop.js, looked up when needed: it loads after this file on the TV)
  const M = factory(typeof require === 'function' ? require('./trash-world') : root.TZW, () => (typeof require === 'function' ? require('./trash-shop') : root.TZP));
  if (typeof module === 'object' && module.exports) module.exports = M; else root.TZS = M;
})(typeof self !== 'undefined' ? self : this, function (W, places) {
  const MAX_TIER = 4;
  const BASE = [0, 60, 170, 330, 540]; // team kills per tier, for one player
  const need = (tier, players) => (tier <= 0 ? 0 : Math.round(BASE[Math.min(MAX_TIER, tier)] * (0.6 + 0.4 * Math.max(1, players || 1))));
  // Unique finds: never in the level-up cards.
  const FINDS = {
    shard1: { kind: 'key', icon: '🗝️', name: 'Key Tooth', desc: 'One third of the boss-door key. Teeth first.' },
    shard2: { kind: 'key', icon: '🗝️', name: 'Key Bow', desc: 'One third of the boss-door key. The handle.' },
    shard3: { kind: 'key', icon: '🗝️', name: 'Key Shaft', desc: 'One third of the boss-door key. The long bit.' },
    map1: { kind: 'map', icon: '🗺️', name: 'Torn Map (left half)', desc: 'Circled in marker: the boss lair is somewhere around here.' },
    map2: { kind: 'map', icon: '🗺️', name: 'Torn Map (right half)', desc: 'X marks the lair. Now everyone knows where the door is.' },
    lid: { kind: 'equip', icon: '🛡️', name: 'Trash-Lid Shield', desc: 'Blocks a hit by itself every 8 seconds.' },
    skates: { kind: 'equip', icon: '🛼', name: 'Rocket Skates', desc: 'Run 30% faster. Forever. Wheee.' },
    blower: { kind: 'equip', icon: '🍃', name: 'Leaf-Blower Mod', desc: 'Bullets shove zombies way back and pierce one more.' },
    goggles: { kind: 'equip', icon: '🥽', name: 'Night-Vision Goggles', desc: '+15% crit chance and auto-aim sees much further.' },
    boombox: { kind: 'equip', icon: '📻', name: 'Busted Boombox', desc: 'Zombies near you dance badly: 25% slower.' },
    twin: { kind: 'ability', icon: '🔫', name: 'Twin Barrels', desc: 'Every shot fires twice.' },
    leech: { kind: 'ability', icon: '🩸', name: 'Leech Rounds', desc: 'Heal 2 for every zombie you take out.' },
    fire: { kind: 'ability', icon: '🔥', name: 'Dumpster Fire', desc: 'A ring of fire burns zombies close to you.' },
    storm: { kind: 'ability', icon: '🌩️', name: 'Storm Can', desc: 'Lightning strikes a zombie every second and a half.' },
    heart: { kind: 'token', icon: '💖', name: 'Spare Heart', desc: 'If you fall, you get right back up (once).' },
  };
  const KEYS = ['shard1', 'shard2', 'shard3'];
  const DOORS = [
    { key: 'vault', name: 'Bank Vault', icon: '🏦', color: '#c9a646' },
    { key: 'hatch', name: 'Sewer Hatch', icon: '🕳️', color: '#5a7a4a' },
    { key: 'lift', name: 'Freight Elevator', icon: '🛗', color: '#8a8f98' },
    { key: 'tunnel', name: 'Tunnel of Gloom', icon: '🎢', color: '#a0407a' },
    { key: 'crusher', name: 'The Crusher', icon: '🏭', color: '#b4552a' },
  ];
  const BOSSES = {
    truck: { name: 'Garbage Truck Titan', icon: '🚛', hp: 2600, r: 70, speed: 60, dmg: 30, desc: 'Charges in straight lines and dumps exploding bags.' },
    ratking: { name: 'The Rat Queen', icon: '🐀', hp: 2200, r: 54, speed: 70, dmg: 22, desc: 'Calls rat swarms and burrows around.' },
    sludge: { name: 'Big Sludge', icon: '🟢', hp: 2800, r: 74, speed: 40, dmg: 26, desc: 'Lobs toxic goo and splits when hurt.' },
    mascot: { name: 'Grinny the Mascot', icon: '🌭', hp: 2400, r: 60, speed: 75, dmg: 24, desc: 'Dashes, spins and sprays foam.' },
    spider: { name: 'Mother Webber', icon: '🕷️', hp: 2500, r: 60, speed: 62, dmg: 22, desc: 'Webs you to the ground and sprays blinding ink.' },
    foghorn: { name: 'The Foghorn', icon: '📯', hp: 2500, r: 60, speed: 52, dmg: 22, desc: 'Its blasts make you dizzy and squint.' },
    toxic: { name: 'Toxic Tub', icon: '☣️', hp: 2700, r: 64, speed: 46, dmg: 24, desc: 'Slimes the ground and gunks up your guns.' },
    // their own arenas (trash-more.js): the truck laps the block, the compactor slams crush walls
    icecream: { name: 'Mister Brain Freeze', icon: '🍦', hp: 2500, r: 66, speed: 120, dmg: 26, desc: 'Plays its jingle, laps the block and leaves slowing slush.' },
    compactor: { name: 'The Big Crunch', icon: '🗜️', hp: 2900, r: 70, speed: 38, dmg: 30, desc: 'Its arena walls slam shut: get out of the red crush zones!' },
  };
  // A few short beats from the radio (and notes) that tell the story as you go.
  const RADIO = 'Dot, Radio Dumpster 101.3';
  const BEATS = {
    start: 'If anyone can hear me: the trash came alive Tuesday. Something under this town is pumping out the stink. Break the gates, find the pieces of the big key. Dot out.',
    tier1: 'Gate down! The stench is thicker past there. Keep smashing, the deeper you go the weirder it gets.',
    tier2: 'You busted the second gates! I found a flyer: "Your Trash, Our Treasure: Sanitation Co." Every zombie wears their uniform. Suspicious.',
    tier3: 'Third gates open. My radio is picking up chewing. Big chewing. The lair must be close.',
    tier4: 'Last gates are down. Whatever is behind that door has been eating the whole town’s garbage. And it’s still hungry.',
    key: 'A key piece! The boss door takes three. Keep them together and keep them clean. Ish.',
    keys: 'All three key pieces! Put them together and find the door. Somebody bring a mop.',
    map1: 'Half a map, circled in marker. The lair is somewhere in that circle. Look on the big screen!',
    map2: 'The other half! X marks the lair: it’s on the big screen now. Go go go.',
    door: 'You found the door! It needs the whole key. Gather up before you open it.',
    open: 'The door is OPEN. Oh no. Oh it’s big. Shoot it! Shoot it a lot!',
    win: 'You did it! The stink is lifting! Radio Dumpster is playing your song all night. Dot out, forever. Or until Tuesday.',
  };
  // ---------------- area locks: the town opens up as the team racks up zombie kills ----------------
  // Every mode. locks(seed, homes, o) -> { req: [81 team kills for one player], kind: [81: null | 'lair' |
  // 'key' | 'shop' | 'den' | 'vault'], door, keys } (o: { mode, party, fixed }). Ordinary blocks open at
  // low counts (a few more kills for every road step from a garage); special blocks (the boss lair, the
  // key vaults, the best shops, zombie dens, loot stashes) need far more and are harder inside. The
  // counts grow with the players (lockNeed). Built so a locked gate is only ever a detour: at every kill
  // count the open part of town is joined to the garages, and every open block has at least two open
  // roads (never a pocket where the only way on is back the way you came).
  const ORD = (d) => (d <= 1 ? 0 : Math.round(10 * Math.pow(d - 1, 1.6)));
  const LOCK = {
    story: { mul: 1, cap: 300, key: [110, 210, 320], lair: 430, master: 260, forge: 300, den: [170], vault: [200], crater: 360, fortress: 300 },
    endless: { mul: 1, cap: 0, master: 260, forge: 320, den: [170, 420], vault: [210, 520, 880], crater: 480, fortress: 400 }, // no cap: further out keeps climbing
    timed: { mul: 0.6, cap: 260, master: 260, forge: 300, den: [170], vault: [200], crater: 280, fortress: 240 }, // Score attack / Garage Defense / wave 20
    party: { mul: 0.5, cap: 150, master: 220, forge: 260, vault: [200] }, // Party Mode: one shared count, few specials
  };
  const SPECIAL = {
    lair: { icon: '☠️', name: 'the boss lair' }, key: { icon: '🗝️', name: 'a key vault' }, shop: { icon: '⚜️', name: 'a master shop' },
    den: { icon: '🧟', name: 'a zombie den' }, vault: { icon: '💎', name: 'a loot stash' }, crater: { icon: '🌋', name: 'the Volcano Crater' }, fortress: { icon: '🏰', name: 'the Frozen Fortress' },
  };
  const lockNeed = (base, players) => Math.round((base || 0) * (0.6 + 0.4 * Math.max(1, players || 1)));
  const lockMode = (o) => (o && o.party ? 'party' : o && o.mode === 'story' ? 'story' : o && o.mode === 'endless' ? 'endless' : 'timed');
  const lockCache = new Map();
  function locks(seed, homes, o = {}) {
    seed = Number(seed) || 1; const N = W.GRID, NN = N * N, T = W.town(seed), mode = lockMode(o), L = LOCK[mode];
    homes = (homes && homes.length ? homes : [[4, 4]]).map((h) => [h[0], h[1]]);
    const ck = [seed, mode, JSON.stringify(homes), JSON.stringify(o.fixed || null)].join('|'); if (lockCache.has(ck)) return lockCache.get(ck);
    const r = W.rng(W.hash(seed, 'locks', mode)), at = (x, y) => y * N + x, home = new Set(homes.map((h) => at(h[0], h[1])));
    const nb = T.cells.map((c) => Object.keys(c.side).filter((d) => c.side[d]).map((d) => at(c.x + W.DIRS[d][0], c.y + W.DIRS[d][1])));
    const dist = W.roadDist(seed, homes), kind = new Array(NN).fill(null), base = new Array(NN).fill(0);
    // a special block never cuts anything off: no two touch, every other block keeps two roads to
    // ordinary blocks, and the ordinary blocks stay joined to the garages without it
    const ok = (i) => {
      if (i < 0 || home.has(i) || kind[i] || !(dist[i] >= 2) || nb[i].some((j) => kind[j])) return false;
      kind[i] = '?';
      let good = nb.every((L2, j) => !!kind[j] || L2.filter((q) => !kind[q]).length >= 2);
      if (good) { const seen = new Set(home), q = [...home]; while (q.length) { const j = q.pop(); for (const k of nb[j]) if (!kind[k] && !seen.has(k)) { seen.add(k); q.push(k); } } good = seen.size === kind.filter((k) => !k).length; }
      kind[i] = null; return good;
    };
    const put = (i, k, b) => { kind[i] = k; base[i] = b; };
    const pick = (lo, hi) => { const C = []; for (let i = 0; i < NN; i++) if (dist[i] >= lo && dist[i] <= hi && ok(i)) C.push(i); return C.length ? C[Math.floor(r() * C.length)] : -1; };
    const top = Math.max(...dist.filter(Number.isFinite)), xy = (i) => [i % N, Math.floor(i / N)];
    let door = null; const keys = [];
    if (o.fixed) { for (const [i, k, b] of o.fixed) if (ok(i)) put(i, k, b); } // a late garage: the same specials as before
    else {
      if (mode === 'story') { let i = -1; for (let d = top; d >= 2 && i < 0; d--) i = pick(d, d); if (i >= 0) { put(i, 'lair', L.lair); door = xy(i); } } // the lair first: one of the farthest blocks
      const P = places(); // the Master Armorer and the Scrapyard Crucible sit behind big gates
      if (P) for (const [k2, t] of Object.entries(P.places(seed))) if (t === 'master' || t === 'forge') { const [x, y] = k2.split(',').map(Number), i = at(x, y); if (ok(i)) put(i, 'shop', L[t]); }
      if (mode === 'story') {
        L.key.forEach((b, n) => { let j = pick([2, 3, 4][n], [4, 6, 99][n]); if (j < 0) j = pick(2, 99); if (j >= 0) { put(j, 'key', b); keys.push(xy(j)); } });
      }
      // the wild realms' big blocks (trash-world.js town(): the crater, the fortress) sit behind big gates too
      for (const k of ['crater', 'fortress']) { const c = T.cells.find((q) => q.d === k); if (c && L[k]) { const i = at(c.x, c.y); if (ok(i)) put(i, k, L[k]); } }
      (L.den || []).forEach((b, n) => { const j = pick(3 + 2 * n, 99); if (j >= 0) put(j, 'den', b); });
      (L.vault || []).forEach((b, n) => { const j = pick(3 + 2 * n, 99); if (j >= 0) put(j, 'vault', b); });
    }
    // The ordinary blocks: what each would like to need (by road steps), then the open town grows from
    // the garages one count at a time, along ordinary roads only; an open block with fewer than two
    // open roads opens its cheapest ordinary neighbour with it (so it is never a dead end).
    const want = new Array(NN), req = new Array(NN).fill(-1), inU = (i) => req[i] >= 0;
    for (let i = 0; i < NN; i++) { let v = Number.isFinite(dist[i]) ? Math.round(ORD(dist[i]) * L.mul) : 0; if (L.cap) v = Math.min(Math.round(L.cap * L.mul), v); want[i] = home.has(i) ? 0 : v; }
    for (const h of home) req[h] = 0;
    const ord = (i) => !kind[i];
    for (const k of [...new Set(want.filter((_, i) => ord(i)))].sort((a, b) => a - b)) {
      for (let changed = true, guard = 0; changed && guard < 400; guard++) {
        changed = false;
        for (let i = 0; i < NN; i++) if (ord(i) && !inU(i) && want[i] <= k && nb[i].some(inU)) { req[i] = k; changed = true; }
        for (let i = 0; i < NN; i++) {
          if (!inU(i) || nb[i].filter(inU).length >= 2) continue;
          const c = nb[i].filter((j) => ord(j) && !inU(j)).sort((a, b) => want[a] - want[b] || a - b)[0];
          if (c != null) { req[c] = k; changed = true; }
        }
      }
    }
    const most = Math.max(0, ...req); for (let i = 0; i < NN; i++) if (ord(i) && req[i] < 0) req[i] = most;
    // The special blocks: well above everything around them (all their roads lead to ordinary blocks).
    for (let i = 0; i < NN; i++) if (kind[i]) req[i] = Math.max(Math.round(base[i] * L.mul), want[i] + Math.round(40 * L.mul), ...nb[i].map((j) => req[j] + Math.round(50 * L.mul)));
    const fixed = []; for (let i = 0; i < NN; i++) if (kind[i]) fixed.push([i, kind[i], base[i]]);
    const out = { mode, req, kind, door, keys, fixed };
    if (lockCache.size > 40) lockCache.clear(); lockCache.set(ck, out); return out;
  }
  function plan(seed, homes) { // tiers: road steps from the nearest garage (where the smaller finds go)
    homes = (homes && homes.length ? homes : [[4, 4]]).map((h) => [h[0], h[1]]);
    const r = W.rng(W.hash(seed, 'story')), LK = locks(seed, homes, { mode: 'story' });
    const N = W.GRID, tiers = [], dist = W.roadDist(seed, homes);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const d = dist[y * N + x];
      tiers.push(d <= 1 ? 0 : Math.min(MAX_TIER, Math.ceil((d - 1) / 2)));
    }
    const tierOf = (x, y) => tiers[y * N + x];
    const cells = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!homes.some((h) => h[0] === x && h[1] === y)) cells.push([x, y]);
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    // the door: the boss lair the locks picked (far away, behind the biggest gate)
    const top = Math.max(...cells.map(([x, y]) => tierOf(x, y)));
    const far = shuffle(cells.filter(([x, y]) => tierOf(x, y) === top));
    const door = LK.door || far[0];
    const finds = {}, special = (x, y) => !!LK.kind[y * N + x];
    const free = (t) => shuffle(cells.filter(([x, y]) => tierOf(x, y) === t && !(x === door[0] && y === door[1]) && !finds[x + ',' + y] && !special(x, y)));
    const put = (id, tiersOk) => { for (const t of tiersOk) { const c = free(Math.min(t, top))[0]; if (c) { finds[c[0] + ',' + c[1]] = id; return; } } };
    // the key pieces: in chests in the key vaults (locked, harder blocks); map halves in the middle, the rest anywhere
    KEYS.forEach((id, n) => { const c = LK.keys[n]; if (c && !finds[c[0] + ',' + c[1]]) finds[c[0] + ',' + c[1]] = id; else put(id, [[1, 2], [2, 3], [3, 4, 2]][n]); });
    put('map1', [2, 1]); put('map2', [3, 2]);
    const extras = shuffle(['lid', 'skates', 'blower', 'goggles', 'boombox', 'twin', 'leech', 'fire', 'storm']).slice(0, 7);
    extras.forEach((id, i) => put(id, [1 + (i % Math.max(1, top)), 1, 2]));
    put('heart', [1]); put('heart', [2, 1]);
    const doorLook = DOORS[Math.floor(r() * DOORS.length)].key;
    const bossKeys = Object.keys(BOSSES), boss = bossKeys[Math.floor(r() * bossKeys.length)];
    // where the first map half points: a 3x3 area that contains the door
    const hint = [Math.max(1, Math.min(N - 2, door[0] + Math.floor(r() * 3) - 1)), Math.max(1, Math.min(N - 2, door[1] + Math.floor(r() * 3) - 1))];
    return { tiers, finds, door, doorLook, boss, hint, top };
  }
  const tierAt = (P, x, y) => (P && P.tiers ? P.tiers[y * W.GRID + x] || 0 : 0);
  return { MAX_TIER, BASE, need, FINDS, KEYS, DOORS, BOSSES, BEATS, RADIO, plan, tierAt, locks, lockNeed, lockMode, LOCK, SPECIAL, ORD };
});
