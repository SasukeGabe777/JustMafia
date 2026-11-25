'use strict';
// TrashZombies phase 3, the shared rules (server, TV and phones; Node: module.exports; browser:
// window.TZX): unlocks that carry over between runs (scrap), difficulty tiers, vehicles, survivors
// to rescue, gameplay weather, Garage Defense (horde nights, the build shop), the helpers (players
// who are down or out, and people watching on a phone) and the TV's highlight moments.
// All names and art are original.
(function (root, factory) {
  const M = factory(typeof require === 'function' ? require('./trash-world') : root.TZW);
  if (typeof module === 'object' && module.exports) module.exports = M; else root.TZX = M;
})(typeof self !== 'undefined' ? self : this, function (W) {
  // ---------------- unlocks (spent with scrap, kept on the player's profile) ----------------
  // kind: cls (a new survivor class, trash-arms.js CLASSES), wp (start every run with this weapon),
  // fit (an outfit piece drawn on your hero), tier (a harder personal difficulty: more scrap).
  const UNLOCKS = [
    { id: 'cls:sparky', kind: 'cls', key: 'sparky', cost: 120, icon: '🔌', name: 'Electrician', desc: 'A new class: starts with the Lightning Coil, shock damage +30%.' },
    { id: 'cls:chef', kind: 'cls', key: 'chef', cost: 120, icon: '🍳', name: 'Grill Cook', desc: 'A new class: starts with the Hairspray Torch, food heals double.' },
    { id: 'cls:janitor', kind: 'cls', key: 'janitor', cost: 150, icon: '🧹', name: 'Night Janitor', desc: 'A new class: zombies near you slip (15% slower), 10% less damage.' },
    { id: 'cls:courier', kind: 'cls', key: 'courier', cost: 150, icon: '📮', name: 'Mail Carrier', desc: 'A new class: +20% speed, vehicles take less damage, rescues pay double.' },
    { id: 'wp:shotgun', kind: 'wp', key: 'shotgun', cost: 80, icon: '💥', name: 'Start with the Scattergun', desc: 'Every run starts with a Scrap Scattergun.' },
    { id: 'wp:smg', kind: 'wp', key: 'smg', cost: 80, icon: '🔩', name: 'Start with the Rattler', desc: 'Every run starts with a Pocket Rattler.' },
    { id: 'wp:nailgun', kind: 'wp', key: 'nailgun', cost: 90, icon: '📌', name: 'Start with the Nail Gun', desc: 'Every run starts with a Nail Gun.' },
    { id: 'wp:crossbow', kind: 'wp', key: 'crossbow', cost: 150, icon: '🏹', name: 'Start with the Crossbow', desc: 'Every run starts with a Fence-Post Crossbow.' },
    { id: 'wp:hubcap', kind: 'wp', key: 'hubcap', cost: 150, icon: '🥏', name: 'Start with the Hubcap', desc: 'Every run starts with a Boomerang Hubcap.' },
    { id: 'wp:flamer', kind: 'wp', key: 'flamer', cost: 180, icon: '🔥', name: 'Start with the Torch', desc: 'Every run starts with a Hairspray Torch.' },
    { id: 'fit:cone', kind: 'fit', key: 'cone', cost: 40, icon: '🔺', name: 'Traffic-Cone Hat', desc: 'Orange, pointy, very official.' },
    { id: 'fit:lid', kind: 'fit', key: 'lid', cost: 40, icon: '🥘', name: 'Trash-Lid Helmet', desc: 'A dented bin lid, worn with pride.' },
    { id: 'fit:chef', kind: 'fit', key: 'chef', cost: 60, icon: '🧁', name: 'Paper Chef Hat', desc: 'Tall, crisp, slightly singed.' },
    { id: 'fit:goggles', kind: 'fit', key: 'goggles', cost: 60, icon: '🥽', name: 'Welding Goggles', desc: 'Big round lenses that glint.' },
    { id: 'fit:cape', kind: 'fit', key: 'cape', cost: 80, icon: '🦸', name: 'Garbage-Bag Cape', desc: 'Flaps dramatically when you run.' },
    { id: 'fit:crown', kind: 'fit', key: 'crown', cost: 120, icon: '👑', name: 'Bottle-Cap Crown', desc: 'Three caps, one ruler of the dump.' },
    { id: 'tier:nightmare', kind: 'tier', key: 'nightmare', cost: 200, icon: '😈', name: 'Nightmare tier', desc: 'Your zombies: +40% health, +30% damage. +50% scrap.' },
    { id: 'tier:apocalypse', kind: 'tier', key: 'apocalypse', cost: 400, icon: '☢️', name: 'Apocalypse tier', desc: 'Your zombies: +90% health, +60% damage, faster. Double scrap.', needs: 'tier:nightmare' },
  ];
  const UNLOCK = Object.fromEntries(UNLOCKS.map((u) => [u.id, u]));
  const TIERS = { normal: { hp: 1, dmg: 1, speed: 1, scrap: 1, name: 'Normal' }, nightmare: { hp: 1.4, dmg: 1.3, speed: 1.05, scrap: 1.5, name: 'Nightmare' }, apocalypse: { hp: 1.9, dmg: 1.6, speed: 1.12, scrap: 2, name: 'Apocalypse' } };
  const SCRAP_MAX = 600;
  // Scrap for a finished night (never in Party Mode).
  const scrapFor = (r) => { const T = TIERS[r.tier] || TIERS.normal; return Math.max(5, Math.min(SCRAP_MAX, Math.round(((r.kills || 0) / 8 + (r.wave || 1) * 4 + (r.rescues || 0) * 12 + (r.nights || 0) * 20 + (r.won ? 60 : 0)) * T.scrap))); };
  const blankMeta = () => ({ scrap: 0, earned: 0, runs: 0, own: [], pick: { cls: null, wp: null, fit: null, tier: null } });
  // Is this pick allowed by what you own?
  const pickOk = (meta, slot, key) => key == null || (meta && meta.own.includes(slot + ':' + key));

  // ---------------- vehicles ----------------
  // speed: x your run speed. hp: what it soaks up for you. blade: contact damage a second (mower).
  const VEHICLES = {
    cart: { icon: '🛒', name: 'Shopping Cart', speed: 1.6, hp: 140, r: 34, ram: 10, desc: 'Fast. Bumps zombies aside.' },
    mower: { icon: '🚜', name: 'Ride-On Mower', speed: 1.12, hp: 220, r: 40, blade: 70, desc: 'Slow, but its blades chew zombies up.' },
    gtruck: { icon: '🚛', name: 'Garbage Truck', speed: 1.45, hp: 700, r: 64, time: 15, desc: 'A rare power-up: drive it for 15 seconds.' },
  };
  // A parked cart or mower in some blocks (same on every phone): carts by shops and lots, mowers in yards.
  const CART_AT = ['mall', 'lot', 'gas', 'roof', 'docks'], MOWER_AT = ['suburb', 'park', 'school', 'carnival'];
  function vehicleAt(seed, x, y, homes) {
    if ((homes || []).some((h) => h[0] === x && h[1] === y)) return null;
    const h = W.hash(seed, 'veh', x, y) % 100, b = W.biomeOf(seed, x, y).key;
    if (CART_AT.includes(b) && h < 45) return 'cart';
    if (MOWER_AT.includes(b) && h < 45) return 'mower';
    return h < 10 ? (h < 5 ? 'cart' : 'mower') : null;
  }

  // ---------------- survivors to rescue ----------------
  const SURV_NAMES = ['Old Gus', 'Nana Pearl', 'Coach Ray', 'Doc Mimi', 'Lil Tobi', 'Mister Pots', 'Auntie Jo', 'Big Hal', 'Sunny Bea', 'Professor Kip', 'Rosa the Baker', 'Ziggy', 'Mabel', 'Farmer Lu'];
  const SURV_COLS = ['#e8b830', '#c37bff', '#3ec1ff', '#ff7a8a', '#7dff6a', '#ffb02e'];
  const SURV_HP = 120, SURV_REWARD = { cash: 60, score: 600, clinic: 1.5 };
  // About one block in seven hides a survivor (never a garage, never a block with a place in it).
  function survivorAt(seed, x, y, homes, placeAt) {
    if ((homes || []).some((h) => h[0] === x && h[1] === y)) return null;
    if (placeAt && placeAt(seed, x, y, homes)) return null;
    const h = W.hash(seed, 'surv', x, y);
    if (h % 7 !== 3) return null;
    return { id: x + ',' + y, name: SURV_NAMES[(h >>> 5) % SURV_NAMES.length], color: SURV_COLS[(h >>> 9) % SURV_COLS.length] };
  }

  // ---------------- weather that changes the fight ----------------
  const WEATHER = {
    clear: { icon: '🌤️', name: 'Clear skies', tip: 'Nothing special out there.' },
    rain: { icon: '🌧️', name: 'Rain', tip: 'Fires go out fast · shock weapons +50%' },
    fog: { icon: '🌫️', name: 'Fog', tip: 'Zombies only notice you up close' },
    heat: { icon: '🥵', name: 'Heat wave', tip: 'Zombies move 25% faster' },
  };
  const WX = { burnRain: 0.35, fireRain: 0.6, shockRain: 1.5, fogNotice: 400, heatSpeed: 1.25, firstMs: 90000, everyMs: 150000 };

  // ---------------- Garage Defense ----------------
  const GARAGE = { every: 5, buildMs: 45000, hordeMs: 210000, hope: 3, door: 900, yard: 560 };
  // What the build phase sells (prices climb each night). Placed where you stand, near your garage.
  const BUILD = {
    barricade: { icon: '🚧', name: 'Barricade', cost: 30, hp: 320, desc: 'Blocks zombies until they smash through it.' },
    turret: { icon: '🗼', name: 'Garage Turret', cost: 60, desc: 'Shoots all night long.' },
    spikes: { icon: '🦔', name: 'Spike Strip', cost: 35, desc: 'Shreds and slows anything that walks over it.' },
    flamer: { icon: '🚿', name: 'Sprinkler-Flamer', cost: 70, desc: 'Sprays a ring of fire every few seconds (rain dampens it).' },
    decoy: { icon: '🚨', name: 'Car-Alarm Decoy', cost: 45, hp: 260, desc: 'Blares and draws zombies away from you.' },
    repair: { icon: '🔧', name: 'Door Repair', cost: 25, n: 300, desc: 'Patch the garage door (+300).' },
  };
  const buildCost = (k, night) => Math.round((BUILD[k] ? BUILD[k].cost : 0) * (1 + 0.25 * Math.max(0, (night || 1) - 1)));
  const hordeSize = (night, players) => Math.round((30 + 16 * night) * (1 + 0.3 * Math.max(0, (players || 1) - 1)));
  const hordeBonus = (night, doorFrac) => Math.round(500 + 250 * night + 500 * Math.max(0, Math.min(1, doorFrac || 0)));

  // ---------------- helpers (down, out, or watching) ----------------
  const HELP = { start: 40, max: 100, regen: 3, crate: { cost: 35, cd: 20000 }, vote: { cost: 10 }, horde: { cost: 60, cd: 45000, leaderCd: 25000 }, pollMs: 30000, pollEvery: 60000 };
  const VOTE_EVENTS = { drop: { icon: '📦', name: 'Supply drop' }, cash: { icon: '💰', name: 'Cash grab' }, horde: { icon: '🧟', name: 'Horde rush' }, alarm: { icon: '🚨', name: 'Car alarm' }, gas: { icon: '☣️', name: 'Gas leak' } };
  const sentHorde = (wave) => 6 + 2 * Math.min(5, Math.floor((wave || 1) / 3));

  // ---------------- highlight moments (the TV recap) ----------------
  // weight: how good a moment is (the recap shows the best one since the last recap).
  const MOMENT_W = { multi: (v) => 40 * v, boss: () => 400, final: () => 1000, streak: (v) => 60 * v, rescue: () => 250, horde: (v) => 300 + 50 * v, revive: () => 150 };
  const momentWeight = (m) => (MOMENT_W[m.kind] ? MOMENT_W[m.kind](m.value || 0) : 0);

  return { UNLOCKS, UNLOCK, TIERS, SCRAP_MAX, scrapFor, blankMeta, pickOk, VEHICLES, vehicleAt, SURV_NAMES, SURV_HP, SURV_REWARD, survivorAt, WEATHER, WX, GARAGE, BUILD, buildCost, hordeSize, hordeBonus, HELP, VOTE_EVENTS, sentHorde, MOMENT_W, momentWeight };
});
