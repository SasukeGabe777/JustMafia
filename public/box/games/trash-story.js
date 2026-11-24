'use strict';
// TrashZombies Regular mode (the story): gated areas, unique finds, the boss door and the bosses.
// Shared by the server, the TV and the phones (Node: module.exports; browser: window.TZS).
//   TZS.plan(seed, homes)  -> { tiers: [81 numbers], finds: { 'x,y': id }, door: [x, y], doorLook, boss }
//   TZS.need(tier, players) -> team kills that open that tier's gates (more players, more kills)
// The plan is made once when the night starts (from the seed and the garages), so every screen
// agrees, and every night is different: the finds, the door's place and look, and the boss.
(function (root, factory) {
  const M = factory(typeof require === 'function' ? require('./trash-world') : root.TZW);
  if (typeof module === 'object' && module.exports) module.exports = M; else root.TZS = M;
})(typeof self !== 'undefined' ? self : this, function (W) {
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
  function plan(seed, homes) { // tiers: road steps from the nearest garage
    homes = (homes && homes.length ? homes : [[4, 4]]).map((h) => [h[0], h[1]]);
    const r = W.rng(W.hash(seed, 'story'));
    const N = W.GRID, tiers = [], dist = W.roadDist(seed, homes);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const d = dist[y * N + x];
      tiers.push(d <= 1 ? 0 : Math.min(MAX_TIER, Math.ceil((d - 1) / 2)));
    }
    const tierOf = (x, y) => tiers[y * N + x];
    const cells = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!homes.some((h) => h[0] === x && h[1] === y)) cells.push([x, y]);
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    // the door: far away (the highest tier there is), random among those
    const top = Math.max(...cells.map(([x, y]) => tierOf(x, y)));
    const far = shuffle(cells.filter(([x, y]) => tierOf(x, y) === top));
    const door = far[0];
    const finds = {};
    const free = (t) => shuffle(cells.filter(([x, y]) => tierOf(x, y) === t && !(x === door[0] && y === door[1]) && !finds[x + ',' + y]));
    const put = (id, tiersOk) => { for (const t of tiersOk) { const c = free(Math.min(t, top))[0]; if (c) { finds[c[0] + ',' + c[1]] = id; return; } } };
    // key pieces spread over the tiers (the last one deep), map halves in the middle, the rest anywhere
    put('shard1', [1, 2]); put('shard2', [2, 3]); put('shard3', [3, 4, 2]);
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
  return { MAX_TIER, BASE, need, FINDS, KEYS, DOORS, BOSSES, BEATS, RADIO, plan, tierAt };
});
