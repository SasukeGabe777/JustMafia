'use strict';
// TrashZombies: the shared world rules (the server, the TV and the phones all load this file).
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

  // ---------------- the looks ----------------
  // ground: base / alt colour; style: how the floor is drawn (public/box/games/trash-art.js);
  // props: what blocks you (and bullets) here; edge: the fence/wall colour around the area.
  const BIOMES = [
    { key: 'junkyard', name: 'Junkyard', icon: '🛞', ground: ['#6b5a43', '#5c4c37'], style: 'gravel', edge: '#3b2f22', accent: '#d9a441', props: ['car', 'tires', 'trash', 'container', 'barrel', 'fridge'] },
    { key: 'suburb', name: 'Suburb Street', icon: '🏡', ground: ['#53585f', '#4f8a3e'], style: 'street', edge: '#2f5a28', accent: '#ffd23f', props: ['car', 'bin', 'hedge', 'tree', 'mailbox', 'car'] },
    { key: 'lot', name: 'Parking Lot', icon: '🅿️', ground: ['#40454d', '#383c43'], style: 'lot', edge: '#22252a', accent: '#f2f2f2', props: ['car', 'car', 'cart', 'barrier', 'car'] },
    { key: 'gas', name: 'Gas Station', icon: '⛽', ground: ['#7c7a73', '#6f6d66'], style: 'slabs', edge: '#3a3833', accent: '#ff5a3c', props: ['pump', 'car', 'barrel', 'crate', 'tires'] },
    { key: 'mall', name: 'Dead Mall', icon: '🛍️', ground: ['#c7bfb1', '#a99f8f'], style: 'checker', edge: '#5d5446', accent: '#ff6fb5', props: ['shelf', 'bench', 'planter', 'cart', 'shelf'] },
    { key: 'park', name: 'Overgrown Park', icon: '🌳', ground: ['#4e7b3b', '#45702f'], style: 'grass', edge: '#2a4a1d', accent: '#ffe066', props: ['tree', 'tree', 'bench', 'bush', 'fountain'] },
    { key: 'roof', name: 'Rooftops', icon: '🏙️', ground: ['#59626c', '#4c545d'], style: 'gravel', edge: '#2b3036', accent: '#7fd6ff', props: ['vent', 'tank', 'crate', 'vent', 'dish'] },
    { key: 'sewer', name: 'Sewer Works', icon: '🕳️', ground: ['#3e4b40', '#334036'], style: 'bricks', edge: '#1d241f', accent: '#9cff5a', props: ['pipe', 'barrel', 'crate', 'pipe', 'grate'] },
    { key: 'carnival', name: 'Busted Carnival', icon: '🎪', ground: ['#7a4c69', '#6a3f5b'], style: 'stripes', edge: '#3a1f33', accent: '#ffd23f', props: ['booth', 'barrel', 'crate', 'booth', 'balloons'] },
    { key: 'school', name: 'Shut School', icon: '🏫', ground: ['#a07a4c', '#8f6b40'], style: 'planks', edge: '#4a3520', accent: '#3ec1ff', props: ['desk', 'locker', 'desk', 'bench', 'desk'] },
    { key: 'docks', name: 'Rusty Docks', icon: '⚓', ground: ['#6b5035', '#5d452c'], style: 'planks', edge: '#1f4a63', accent: '#ff8c42', props: ['container', 'crate', 'barrel', 'rope', 'crate'] },
    { key: 'landfill', name: 'Landfill Hills', icon: '🗑️', ground: ['#6c6a3d', '#5f5d33'], style: 'dirt', edge: '#3a3820', accent: '#c8ff3c', props: ['trash', 'trash', 'tires', 'bags', 'fridge'] },
  ];
  const HOME = { key: 'home', name: 'Your Street', icon: '🏠', ground: ['#4d535a', '#5a8a45'], style: 'street', edge: '#2f5a28', accent: '#ffd23f', props: ['bin', 'car', 'hedge', 'mailbox', 'bin'] };
  // Props: size in tiles, round or boxy, and whether bullets fly over them (low props).
  const PROPS = {
    car: { w: 2, h: 1, kind: 'car' }, container: { w: 3, h: 1, kind: 'container' }, tires: { w: 1, h: 1, round: true }, trash: { w: 1, h: 1, round: true },
    barrel: { w: 1, h: 1, round: true }, fridge: { w: 1, h: 1 }, bin: { w: 1, h: 1, round: true }, hedge: { w: 2, h: 1 }, tree: { w: 1, h: 1, round: true },
    mailbox: { w: 1, h: 1, round: true }, cart: { w: 1, h: 1 }, barrier: { w: 2, h: 1 }, pump: { w: 1, h: 2 }, crate: { w: 1, h: 1 }, shelf: { w: 3, h: 1 },
    bench: { w: 2, h: 1 }, planter: { w: 1, h: 1, round: true }, bush: { w: 1, h: 1, round: true }, fountain: { w: 2, h: 2, round: true }, vent: { w: 2, h: 1 },
    tank: { w: 2, h: 2, round: true }, dish: { w: 1, h: 1, round: true }, pipe: { w: 3, h: 1 }, grate: { w: 2, h: 1 }, booth: { w: 2, h: 2 }, balloons: { w: 1, h: 1, round: true },
    desk: { w: 2, h: 1 }, locker: { w: 3, h: 1 }, rope: { w: 1, h: 1, round: true }, bags: { w: 1, h: 1, round: true },
  };
  // A cell's look: neighbours never share one (5 and 3 steps apart in a seeded order of the 12).
  function biomeOf(seed, x, y, homes) {
    if (homes && homes.some((h) => h[0] === x && h[1] === y)) return HOME;
    const r = rng(hash(seed, 'order')), order = BIOMES.map((b, i) => [r(), i]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
    const off = hash(seed, 'off') % 12;
    return BIOMES[order[(((5 * x + 3 * y + off) % 12) + 12) % 12]];
  }
  const inGrid = (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < GRID && y < GRID;
  const exitsOf = (x, y) => ({ n: y > 0, s: y < GRID - 1, w: x > 0, e: x < GRID - 1 });
  // The garage you start in (home cells): top middle, door facing down.
  const GARAGE = { x: 7 * TILE, y: 0, w: 6 * TILE, h: 3 * TILE, door: { x: 8 * TILE, w: 4 * TILE } };

  // An area's layout from (seed, x, y). Obstacles are axis-aligned boxes (round ones collide as
  // boxes too, a little smaller). The border ring, the exit lanes and the middle stay clear.
  function genArea(seed, x, y, home) {
    const r = rng(hash(seed, 'area', x, y));
    const biome = home ? HOME : biomeOf(seed, x, y);
    const used = Array.from({ length: TH }, () => new Array(TW).fill(0));
    const block = (tx, ty, w, h, v = 1) => { for (let j = ty; j < ty + h; j++) for (let i = tx; i < tx + w; i++) if (j >= 0 && i >= 0 && j < TH && i < TW) used[j][i] = v; };
    // reserved: the 1-tile border, the exit lanes (2 tiles wide) through the middle of each edge, the middle
    block(0, 0, TW, 1, 2); block(0, TH - 1, TW, 1, 2); block(0, 0, 1, TH, 2); block(TW - 1, 0, 1, TH, 2);
    block(TW / 2 - 1, 0, 2, TH, 2); block(0, TH / 2 - 1, TW, 2, 2); block(TW / 2 - 3, TH / 2 - 2, 6, 4, 2);
    const obstacles = [];
    let garage = null;
    if (home) { garage = { ...GARAGE, kind: 'garage' }; block(GARAGE.x / TILE - 1, 0, GARAGE.w / TILE + 2, GARAGE.h / TILE + 2, 2); }
    const want = 9 + Math.floor(r() * 6);
    for (let tries = 0; tries < 300 && obstacles.length < want; tries++) {
      const kind = pick(r, biome.props), P = PROPS[kind];
      const rot = !P.round && P.w !== P.h && r() < 0.35; // some props stand on end
      const w = rot ? P.h : P.w, h = rot ? P.w : P.h;
      const tx = 1 + Math.floor(r() * (TW - w - 1)), ty = 1 + Math.floor(r() * (TH - h - 1));
      let ok = true;
      for (let j = ty - 1; j <= ty + h && ok; j++) for (let i = tx - 1; i <= tx + w && ok; i++) { if (j < 0 || i < 0 || j >= TH || i >= TW) continue; const u = used[j][i]; if (u === 1 || (u === 2 && j >= ty && j < ty + h && i >= tx && i < tx + w)) ok = false; }
      if (!ok) continue;
      block(tx, ty, w, h, 1);
      const pad = P.round ? 10 : 6;
      obstacles.push({ x: tx * TILE + pad, y: ty * TILE + pad, w: w * TILE - pad * 2, h: h * TILE - pad * 2, kind, round: !!P.round, rot, v: Math.floor(r() * 4), seed: Math.floor(r() * 1e6) });
    }
    if (garage) { obstacles.push({ x: garage.x, y: 0, w: garage.door.x - garage.x, h: garage.h, kind: 'wall' }); obstacles.push({ x: garage.door.x + garage.door.w, y: 0, w: garage.x + garage.w - garage.door.x - garage.door.w, h: garage.h, kind: 'wall' }); }
    const decals = [];
    const nd = 40 + Math.floor(r() * 25);
    for (let i = 0; i < nd; i++) decals.push({ x: r() * AW, y: r() * AH, k: Math.floor(r() * 6), s: 0.6 + r() * 0.9, a: r() * Math.PI * 2 });
    return { x, y, seed, biome, obstacles, decals, garage, home: !!home, exits: exitsOf(x, y) };
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
    const open = (c) => ABILITIES.filter((a) => a.cat === c);
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
    { id: 'minigun', icon: '🔥', name: 'Buzzsaw Minigun', dur: 15, color: '#ffb02e', desc: '15 seconds of crazy-fast fire.' },
    { id: 'kicks', icon: '👟', name: 'Rocket Sneakers', dur: 10, color: '#7dff6a', desc: 'Run way faster for 10 seconds.' },
    { id: 'nuke', icon: '☢️', name: 'Garbage Day', dur: 0, color: '#c8ff3c', desc: 'Every zombie here gets taken out.' },
    { id: 'freeze', icon: '🧊', name: 'Freezer Burn', dur: 6, color: '#bfefff', desc: 'Zombies freeze solid for 6 seconds.' },
    { id: 'snack', icon: '🌭', name: 'Health Snack', dur: 0, color: '#ff7a8a', desc: 'Heal 35 health.' },
    { id: 'xp2', icon: '✨', name: 'Double XP', dur: 20, color: '#ffe066', desc: 'Twice the XP for 20 seconds.' },
    { id: 'scope', icon: '🔭', name: 'Lookout Binoculars', dur: 20, color: '#9fd8ff', desc: 'See way further for 20 seconds.' },
  ];
  const PK = Object.fromEntries(PICKUPS.map((p) => [p.id, p]));

  // ---------------- zombies + waves ----------------
  const ZOMBIES = {
    walker: { name: 'Shambler', r: 19, hp: 20, speed: 70, dmg: 10, xp: 1, from: 1, w: 10 },
    runner: { name: 'Sprinter', r: 16, hp: 13, speed: 150, dmg: 8, xp: 1, from: 2, w: 5 },
    bloater: { name: 'Bloater', r: 29, hp: 55, speed: 48, dmg: 14, xp: 3, from: 3, w: 2, pops: true },
    canhead: { name: 'Can-Head', r: 22, hp: 80, speed: 62, dmg: 12, xp: 3, from: 4, w: 2, tough: true },
    spitter: { name: 'Spitter', r: 18, hp: 24, speed: 62, dmg: 9, xp: 2, from: 5, w: 2, spits: true },
    boss: { name: 'Dumpster Brute', r: 56, hp: 650, speed: 52, dmg: 25, xp: 30, from: 99, w: 0, boss: true },
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
      weights: Object.entries(ZOMBIES).filter(([, z]) => z.from <= wave && z.w).map(([k, z]) => [k, z.w + (k === 'walker' ? 0 : Math.min(6, (wave - z.from) * 0.6))]),
    };
  }
  const xpNeed = (level) => Math.round(5 + level * 4 + Math.pow(level, 1.5));
  // The most a run can plausibly have (the server's loose sanity checks).
  const limits = { level: (kills) => 1 + Math.floor(Math.sqrt(kills * 3 + 4)) + 6, hp: (lvl) => 100 + 25 * Math.max(1, lvl) + 200 };
  // Soft cap: grows with n but never passes `top` (diminishing returns).
  const soft = (n, top, k) => top * (1 - Math.pow(k, n || 0));

  return { GRID, AW, AH, TILE, TW, TH, BIOMES, HOME, PROPS, biomeOf, inGrid, exitsOf, genArea, GARAGE, spawnCell, ABILITIES, AB, CATS, offer, levelsFromAbilities, PICKUPS, PK, ZOMBIES, waveSpec, xpNeed, limits, soft, hash, rng };
});
