'use strict';
// TrashZombies places, goods and score (shared by the server, the TV and the phones;
// Node: module.exports; browser: window.TZP).
//   TZP.places(seed)        -> { 'x,y': type } the specialised places of a town (same for every screen)
//   TZP.stock(r, type, wave, ctx) -> good ids on the shelf; TZP.price(id, wave) -> cash
//   TZP.points(type)        -> score for a kill; TZP.mult(streak) -> the streak multiplier
// Each place does its own thing: the market sells food and odd specials, the surplus store armour and
// gear, the clinic health, the three gun merchants upgrade weapons in their own level range, and the
// crucible (rare, far away) evolves a level-10 weapon to the next tier.
(function (root, factory) {
  const M = factory(typeof require === 'function' ? require('./trash-world') : root.TZW);
  if (typeof module === 'object' && module.exports) module.exports = M; else root.TZP = M;
})(typeof self !== 'undefined' ? self : this, function (W) {
  const PLACES = {
    market: { name: 'Corner Market', icon: '🏪', color: '#e0a030', where: ['suburb', 'roof', 'gas', 'mall', 'lot'], n: 4, says: ['Cash only. Zombie cash counts.', 'Hot dogs are three days old. Still good!', 'No shirt, no shoes, no brains? Still served.'] },
    armor: { name: 'Army Surplus', icon: '🦺', color: '#6b8a4a', where: ['roof', 'lot', 'junkyard', 'docks', 'gas'], n: 3, says: ['Vests, helmets, boom-boom. All slightly used.', 'Everything must go. Including me, eventually.', 'That plate stopped a bullet once. Probably.'] },
    clinic: { name: 'Free Clinic', icon: '🏥', color: '#e8483a', where: ['roof', 'school', 'mall', 'suburb'], n: 3, says: ['Say ahh. Not you, the zombie.', 'Take two of these and don’t get bitten.', 'The doctor is in. The doctor is nervous.'] },
    tinker: { name: 'Street Tinkerer', icon: '🔧', color: '#c9a43a', where: ['junkyard', 'landfill', 'carnival', 'lot', 'sewer'], n: 3, up: [1, 5], says: ['Duct tape fixes guns. And feelings.', 'Hand it over, I’ll make it go pew-er.'] },
    gunsmith: { name: 'Gunsmith', icon: '🛠️', color: '#9a9fa6', where: ['roof', 'gas', 'docks', 'mall'], n: 2, up: [5, 8], says: ['Real tools, real work. Level five and up.', 'That thing’s been through the wars. Let’s fix that.'] },
    master: { name: 'Master Armorer', icon: '⚜️', color: '#ffd23f', where: null, n: 1, up: [8, 10], far: true, says: ['Only the finest work. Levels eight to ten.', 'You came a long way. So did that weapon.'] },
    forge: { name: 'Scrapyard Crucible', icon: '🔥', color: '#ff6a2a', where: ['junkyard', 'sewer', 'docks', 'landfill'], n: 1, far: true, says: ['A level-ten weapon goes in. Something better comes out.', 'Bring a crucible core. The fire needs feeding.'] },
    truck: { name: 'Roaming Trader', icon: '🚚', color: '#c37bff', says: ['Fresh off the truck! Well, fresh-ish.', 'I don’t stay long. Zombies scratch the paint.'] },
    camper: { name: 'Survivor Camper', icon: '🚐', color: '#8ab4d8', says: ['Parked here for one wave. Quick, browse!', 'Had to move the van. Smelled like zombie.'] },
  };
  const KEYS = Object.keys(PLACES).filter((k) => k !== 'camper' && k !== 'truck');
  // The places of a town: about one block in five, where they fit (markets on main streets in
  // the suburbs, the crucible deep in the junk), the master armorer and the crucible far from the
  // middle. Deterministic per seed.
  const cache = new Map();
  function places(seed) {
    seed = Number(seed) || 1; if (cache.has(seed)) return cache.get(seed);
    const T = W.town(seed), r = W.rng(W.hash(seed, 'places')), out = {}, N = W.GRID, d = W.roadDist(seed, [[4, 4]]);
    const free = T.cells.filter((c) => !(c.x === 4 && c.y === 4));
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const near = (c) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => out[(c.x + dx) + ',' + (c.y + dy)]);
    for (const type of ['forge', 'master', 'gunsmith', 'tinker', 'clinic', 'armor', 'market']) {
      const P = PLACES[type], far = Math.max(...free.map((c) => d[c.y * N + c.x]));
      for (let i = 0; i < P.n; i++) {
        let L = shuffle(free.filter((c) => !out[c.x + ',' + c.y] && !near(c)));
        if (P.far) L = L.filter((c) => d[c.y * N + c.x] >= Math.max(3, far - 3));
        const fit = P.where ? L.filter((c) => P.where.includes(c.d)) : L;
        const c = (fit.length ? fit : L)[0]; if (c) out[c.x + ',' + c.y] = type;
      }
    }
    if (cache.size > 16) cache.clear();
    cache.set(seed, out); return out;
  }
  const placeAt = (seed, x, y, homes) => ((homes || []).some((h) => h[0] === x && h[1] === y) ? null : places(seed)[x + ',' + y] || null);

  // ---------------- goods ----------------
  // kind: what the phone does with it. base: the price at wave 1 (prices climb with the wave).
  const GOODS = {
    // market: food (healing over time, short buffs), snacks for XP, specials
    hotdog: { shop: 'market', icon: '🌭', name: 'Gas-Station Hot Dog', desc: 'Heal 40 over 5 seconds.', base: 12, kind: 'food', heal: 40 },
    pizza: { shop: 'market', icon: '🍕', name: 'Whole Cold Pizza', desc: 'Heal 80 over 8 seconds.', base: 22, kind: 'food', heal: 80 },
    soda: { shop: 'market', icon: '🥤', name: 'Rocket Soda', desc: 'Run 40% faster for 30 seconds.', base: 15, kind: 'buff', buff: 'kicks', dur: 30 },
    gum: { shop: 'market', icon: '🍬', name: 'Lucky Gum', desc: 'Double XP for 30 seconds.', base: 18, kind: 'buff', buff: 'xp2', dur: 30 },
    chips: { shop: 'market', icon: '🥔', name: 'Brain Chips', desc: 'A bag of XP: almost a level.', base: 20, kind: 'xp' },
    ticket: { shop: 'market', icon: '🎟️', name: 'Scratch Ticket', desc: 'Your next level-up shows fresh cards (a reroll you keep).', base: 14, kind: 'reroll' },
    book: { shop: 'market', icon: '📕', name: 'Self-Help Book', desc: 'Learn one ability of your choice (pricey).', base: 45, kind: 'ability' },
    bag: { shop: 'market', icon: '🛍️', name: 'Mystery Bag', desc: 'A random pickup for your pocket (use it any time).', base: 16, kind: 'pocket' },
    // surplus store: armour + utility
    plate: { shop: 'armor', icon: '🛡️', name: 'Armor Plate', desc: 'Soaks up the next 3 hits.', base: 20, kind: 'plates', n: 3 },
    helmet: { shop: 'armor', icon: '⛑️', name: 'Hard Hat', desc: '+20 max health for this run.', base: 26, kind: 'mhp', n: 20 },
    vest: { shop: 'armor', icon: '🦺', name: 'Kevlar Vest', desc: 'Take 8% less damage for this run.', base: 34, kind: 'vest' },
    grenade: { shop: 'armor', icon: '💣', name: 'Bomb Charge', desc: 'One screen-clearing blast (the 💣 button).', base: 30, kind: 'bomb' },
    turret: { shop: 'armor', icon: '🗼', name: 'Turret Kit', desc: 'Drop a little auto-turret (the 🗼 button).', base: 28, kind: 'turretkit' },
    torch: { shop: 'armor', icon: '🔦', name: 'Big Flashlight', desc: 'See further, and a wider beam at night.', base: 22, kind: 'torch' },
    // clinic: health
    medkit: { shop: 'clinic', icon: '❤️‍🩹', name: 'Full Patch-Up', desc: 'Heal to full right now.', base: 18, kind: 'full' },
    vitamins: { shop: 'clinic', icon: '💊', name: 'Mega Vitamins', desc: '+30 max health for this run (and heal 30).', base: 30, kind: 'mhp', n: 30 },
    token: { shop: 'clinic', icon: '💖', name: 'Revive Token', desc: 'If you fall, you get right back up (once).', base: 60, kind: 'life' },
    bandage: { shop: 'clinic', icon: '🩹', name: 'Bandages', desc: 'Heal 45.', base: 9, kind: 'heal', n: 45 },
    antidote: { shop: 'clinic', icon: '🧪', name: 'Antidote', desc: 'Clears every debuff now (ink, webs, dizziness...).', base: 12, kind: 'cleanse' },
  };
  const BY_SHOP = {}; for (const [id, G] of Object.entries(GOODS)) (BY_SHOP[G.shop] || (BY_SHOP[G.shop] = [])).push(id);
  BY_SHOP.camper = ['hotdog', 'bandage', 'plate', 'chips', 'bag', 'soda'];
  BY_SHOP.truck = ['bag', 'grenade', 'chips'];
  const price = (id, wave, n = 0) => { const G = GOODS[id]; if (!G) return 0; return Math.round(G.base * (1 + 0.11 * Math.max(0, (wave || 1) - 1)) * (1 + 0.25 * n)); };
  function stock(r, type, wave) {
    const L = (BY_SHOP[type] || []).slice(); for (let i = L.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [L[i], L[j]] = [L[j], L[i]]; }
    return L.slice(0, Math.min(L.length, 4 + Math.floor(r() * 3)));
  }
  // ---------------- score ----------------
  const POINTS = { walker: 10, runner: 15, bloater: 25, canhead: 30, spitter: 25, crawler: 15, screamer: 40, stalker: 35, exploder: 25, brute: 60, riot: 45, nest: 80, boss: 500, final: 5000 };
  const points = (type, elite) => (POINTS[type] || 10) * (elite ? 3 : 1);
  // the streak multiplier: x1, x2 after 8 quick kills, x3 after 20, ... (8, 20, 36, 56, ...)
  const mult = (n) => { let m = 1, need = 8, step = 12; while (n >= need && m < 12) { m++; need += step; step += 4; } return m; };
  const BONUS = { clear: 100, flawless: 250, boss: 1000, find: 250, multi: 50 };
  return { PLACES, KEYS, places, placeAt, GOODS, BY_SHOP, price, stock, POINTS, points, mult, BONUS };
});
