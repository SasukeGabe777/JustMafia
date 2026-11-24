'use strict';
// TrashZombies gear (shared by the server, the TV and the phones; Node: module.exports; browser: window.TZR):
// weapons (levels 1-10 at the gun merchants, tiers 1-3 at the crucible), weapon combos, the timed
// super weapons (some zombies carry them), survivor classes, passive items with trade-offs, and the
// debuffs some zombies (and bosses) put on you. All names are original.
(function (root, factory) {
  const M = factory();
  if (typeof module === 'object' && module.exports) module.exports = M; else root.TZR = M;
})(typeof self !== 'undefined' ? self : this, function () {
  // kind: how it fires (trash-fight.js). rate: shots a second; dmg: x your gun damage; range: px.
  // names: [tier 1, tier 2, tier 3 (the fully evolved form)].
  const WEAPONS = {
    pistol: { kind: 'pistol', rar: 'common', icon: '🔫', rate: 0, dmg: 1, range: 640, names: ['Pipe Blaster', 'Chrome Pipe Blaster', 'Golden Hand-Cannon'], color: '#c9ccd1' },
    shotgun: { kind: 'spread', rar: 'common', icon: '💥', rate: 1.1, dmg: 0.9, range: 330, pellets: 6, names: ['Scrap Scattergun', 'Double-Barrel Dumpster', 'Thunder Mouth'], color: '#e8b830' },
    smg: { kind: 'rattle', rar: 'common', icon: '🔩', rate: 9, dmg: 0.42, range: 560, names: ['Pocket Rattler', 'Rattle-Snake', 'Hailstorm'], color: '#d8d6cc' },
    nailgun: { kind: 'nail', rar: 'common', icon: '📌', rate: 4, dmg: 0.8, range: 560, pierce: 2, names: ['Nail Gun', 'Roofing Gun', 'Iron Rain'], color: '#9aa2aa' },
    bat: { kind: 'swing', rar: 'common', icon: '🏏', rate: 1.6, dmg: 3, range: 95, names: ['Nail Bat', 'Barbed Bat', 'Home-Run Hammer'], color: '#a8743a' },
    crossbow: { kind: 'bolt', rar: 'rare', icon: '🏹', rate: 1, dmg: 4.5, range: 900, pierce: 99, names: ['Fence-Post Crossbow', 'Rebar Ballista', 'Skewer King'], color: '#8a6238' },
    flamer: { kind: 'cone', rar: 'rare', icon: '🔥', rate: 12, dmg: 0.32, range: 190, burn: 1, names: ['Hairspray Torch', 'Bug-Bomb Burner', 'Dragon’s Breath'], color: '#ff8c2e' },
    blower: { kind: 'push', rar: 'rare', icon: '🍃', rate: 6, dmg: 0.25, range: 230, names: ['Leaf Blower', 'Gale Pack', 'Hurricane Hose'], color: '#9ad86a' },
    hubcap: { kind: 'boomer', rar: 'rare', icon: '🥏', rate: 0.9, dmg: 2.2, range: 480, names: ['Boomerang Hubcap', 'Spinning Rim', 'Chrome Cyclone'], color: '#c9ced6' },
    launcher: { kind: 'lob', rar: 'epic', icon: '🧨', rate: 0.8, dmg: 3.5, range: 520, names: ['Pipe Launcher', 'Mortar Can', 'Fireworks Finale'], color: '#c0392b' },
    coil: { kind: 'zap', rar: 'epic', icon: '⚡', rate: 1.3, dmg: 2.4, range: 420, names: ['Lightning Coil', 'Tesla Trash-Can', 'Storm Crown'], color: '#9ff0ff' },
    saw: { kind: 'saw', rar: 'epic', icon: '🪚', rate: 10, dmg: 0.6, range: 80, names: ['Chainsaw', 'Twin Chainsaw', 'Lumberjack’s Fury'], color: '#d9a441' },
    rail: { kind: 'rail', rar: 'legendary', icon: '📡', rate: 0.5, dmg: 9, range: 1400, names: ['Rail Rifle', 'Microwave Rail', 'Sky Splitter'], color: '#7fd6ff' },
  };
  const RARITY = { common: { name: 'Common', color: '#c9ccd1', price: 1 }, rare: { name: 'Rare', color: '#3ec1ff', price: 1.5 }, epic: { name: 'Epic', color: '#c37bff', price: 2.2 }, legendary: { name: 'Legendary', color: '#ffb02e', price: 3.2 } };
  const SLOTS = 4; // extra weapons next to your pistol (they all fire by themselves)
  const MAX_LV = 10, MAX_TIER = 3, TIER_MUL = [1, 2.2, 5];
  const power = (lv, tier) => (1 + 0.16 * (lv - 1)) * TIER_MUL[Math.max(0, Math.min(2, tier - 1))];
  const speed = (lv, tier) => 1 + 0.035 * (lv - 1) + 0.12 * (tier - 1);
  const wname = (id, tier) => (WEAPONS[id] ? WEAPONS[id].names[Math.max(0, Math.min(2, (tier || 1) - 1))] : id);
  // An upgrade at a merchant: which rank may do it, and the price.
  const RANKS = { tinker: [1, 5], gunsmith: [5, 8], master: [8, 10] };
  const canUpgrade = (rank, lv) => { const r = RANKS[rank]; return !!r && lv >= r[0] && lv < r[1] && lv < MAX_LV; };
  const upgradeCost = (id, lv, tier, wave) => Math.round((25 + 18 * lv) * RARITY[(WEAPONS[id] || WEAPONS.pistol).rar].price * [1, 2, 3.5][tier - 1] * (1 + 0.06 * Math.max(0, (wave || 1) - 1)));
  const weaponCost = (id, wave) => Math.round(45 * RARITY[WEAPONS[id].rar].price * (1 + 0.08 * Math.max(0, (wave || 1) - 1)));
  // Evolving at the crucible: a level-10 weapon below tier 3, and a crucible core (bosses drop them).
  const canEvolve = (w, cores) => !!w && w.lv >= MAX_LV && w.tier < MAX_TIER && cores > 0;
  // ---------------- combos ----------------
  // Own both halves (weapons, abilities or used gear) and they fuse into something new.
  const COMBOS = [
    { id: 'firetornado', need: ['w:flamer', 'w:blower'], icon: '🌪️', name: 'Fire Tornado', desc: 'The blower’s gusts catch fire and spin zombies around.' },
    { id: 'arcnails', need: ['w:nailgun', 'w:coil'], icon: '⚡', name: 'Arc Nails', desc: 'Every nail sparks a little chain of lightning.' },
    { id: 'boombolts', need: ['w:crossbow', 'w:launcher'], icon: '💥', name: 'Boom Bolts', desc: 'Crossbow bolts explode at the end of their flight.' },
    { id: 'pinball', need: ['w:shotgun', 'a:bounce'], icon: '🎱', name: 'Pinball Shells', desc: 'Shotgun pellets bounce off walls twice more.' },
    { id: 'flyturret', need: ['g:turret', 'a:drone'], icon: '🛸', name: 'Flying Turret', desc: 'Your turrets hover after you and fire twice as fast.' },
    { id: 'luckyrattle', need: ['w:smg', 'a:crit'], icon: '🍀', name: 'Lucky Rattler', desc: 'The rattler crits twice as often.' },
    { id: 'hubstorm', need: ['w:hubcap', 'a:orbit'], icon: '🌀', name: 'Hubcap Storm', desc: 'Two more hubcaps spin around you.' },
    { id: 'spikebat', need: ['w:bat', 'a:thorns'], icon: '🌵', name: 'Spiked Bat', desc: 'The bat hits twice as hard and sets zombies bleeding.' },
    { id: 'railstorm', need: ['w:rail', 'a:zap'], icon: '🌩️', name: 'Thunder Rail', desc: 'Rail shots leave a trail of lightning.' },
    { id: 'sawfire', need: ['w:saw', 'a:burn'], icon: '🔥', name: 'Hot Saw', desc: 'The chainsaw sets everything it touches on fire.' },
  ];
  // Timed super weapons (pickups; some zombies carry them and drop them).
  const TIMED = {
    minigun: { icon: '🔥', name: 'Buzzsaw Minigun', dur: 12, color: '#ffb02e' },
    rockets: { icon: '🚀', name: 'Rocket Barrage', dur: 8, color: '#ff5a3c' },
    raygun: { icon: '🛸', name: 'Ray Gun', dur: 10, color: '#7dff6a' },
    truck: { icon: '🚛', name: 'Garbage-Truck Ram', dur: 10, color: '#3d8a4a' },
  };
  const TIMED_COMBOS = [
    { need: ['minigun', 'rockets'], icon: '🚀', name: 'Rocket Minigun' },
    { need: ['minigun', 'raygun'], icon: '🛸', name: 'Ray Minigun' },
    { need: ['rockets', 'truck'], icon: '💣', name: 'Rocket Truck' },
    { need: ['raygun', 'truck'], icon: '👽', name: 'UFO Truck' },
  ];
  // ---------------- survivor classes ----------------
  const CLASSES = {
    medic: { icon: '🩺', name: 'Medic', desc: 'Heals 2 a second, revives friends twice as fast, food heals 50% more.', bias: ['regen', 'hp', 'shove'] },
    demo: { icon: '🧨', name: 'Demolitionist', desc: 'Explosions 40% bigger and stronger; starts with 2 bomb charges.', bias: ['bomb', 'big', 'spread'] },
    brawler: { icon: '🥊', name: 'Brawler', desc: '+40% health, starts with the Nail Bat, hits back when touched.', bias: ['thorns', 'hp', 'plating'] },
    sharp: { icon: '🎯', name: 'Sharpshooter', desc: '+15% crit chance, crits hit even harder, and you shoot further.', bias: ['crit', 'pierce', 'rapid'] },
    scav: { icon: '🦝', name: 'Scavenger', desc: '+60% cash, twice the pickups, a bigger magnet.', bias: ['magnet', 'raccoon', 'kicks'] },
    tinker: { icon: '🔧', name: 'Tinkerer', desc: 'Starts with 2 turret kits; turrets last twice as long and fire faster.', bias: ['drone', 'zap', 'orbit'] },
  };
  // ---------------- passive items (shops; trade-offs) ----------------
  const ITEMS = {
    boots: { rar: 'rare', icon: '🥾', name: 'Lead Boots', desc: '+20% damage, -10% speed.', fx: { dmg: 0.2, speed: -0.1 } },
    sock: { rar: 'common', icon: '🧦', name: 'Lucky Rabbit Sock', desc: '+50% pickups and cash drops.', fx: { luck: 0.5 } },
    piggy: { rar: 'common', icon: '🐷', name: 'Piggy Bank', desc: '+$12 every wave you clear.', fx: { interest: 12 } },
    pads: { rar: 'common', icon: '🧤', name: 'Riot Pads', desc: 'Take 10% less damage, -5% dodge.', fx: { armor: 0.1, dodge: -0.05 } },
    knuckles: { rar: 'epic', icon: '🥃', name: 'Glass Knuckles', desc: '+35% damage, -20 max health.', fx: { dmg: 0.35, mhp: -20 } },
    coffee: { rar: 'rare', icon: '☕', name: 'Coffee Drip', desc: '+20% fire rate, -10 max health.', fx: { rate: 0.2, mhp: -10 } },
    belt: { rar: 'common', icon: '🧲', name: 'Magnet Belt', desc: '+60% pickup range.', fx: { magnet: 0.6 } },
    skin: { rar: 'rare', icon: '🦏', name: 'Thick Skin', desc: '+40 max health, -8% speed.', fx: { mhp: 40, speed: -0.08 } },
    tooth: { rar: 'epic', icon: '🦷', name: 'Gold Tooth', desc: '+15% crit chance; crits heal 1.', fx: { crit: 0.15, critHeal: 1 } },
    repel: { rar: 'rare', icon: '🧴', name: 'Zombie Repellent', desc: 'Zombies 10% slower, -10% XP.', fx: { zslow: 0.1, xp: -0.1 } },
    crown: { rar: 'legendary', icon: '👑', name: 'Trash Crown', desc: 'x1.25 score, but take 15% more damage.', fx: { score: 0.25, armor: -0.15 } },
    springs: { rar: 'common', icon: '🦘', name: 'Spring Shoes', desc: '+25% speed, -10% damage.', fx: { speed: 0.25, dmg: -0.1 } },
  };
  const itemCost = (id, wave) => Math.round(30 * RARITY[ITEMS[id].rar].price * (1 + 0.08 * Math.max(0, (wave || 1) - 1)));
  const rerollCost = (n) => 10 * Math.pow(2, n);
  // ---------------- debuffs (zombie attacks) ----------------
  // short; at most 2 at once; after one wears off you're immune to that kind for a few seconds.
  const DEBUFFS = {
    blind: { icon: '🦑', name: 'Inked', dur: 4, color: '#2a1a3a' },
    zoom: { icon: '🔍', name: 'Squinting', dur: 5, color: '#ffe066' },
    web: { icon: '🕸️', name: 'Webbed', dur: 3, color: '#e8e8e8' },
    jam: { icon: '🔧', name: 'Jammed', dur: 5, color: '#9aa2aa' },
    confuse: { icon: '😵', name: 'Dizzy', dur: 3.5, color: '#c37bff' },
    leech: { icon: '🩸', name: 'Leeched', dur: 5, color: '#c0392b' },
    sludge: { icon: '🟢', name: 'Sludged', dur: 3, color: '#7ad03a' },
    shake: { icon: '💫', name: 'Rattled', dur: 4, color: '#ff8c42' },
  };
  const MAX_DEBUFFS = 2, IMMUNE_S = 4;
  return { WEAPONS, RARITY, SLOTS, MAX_LV, MAX_TIER, TIER_MUL, power, speed, wname, RANKS, canUpgrade, upgradeCost, weaponCost, canEvolve, COMBOS, TIMED, TIMED_COMBOS, CLASSES, ITEMS, itemCost, rerollCost, DEBUFFS, MAX_DEBUFFS, IMMUNE_S };
});
