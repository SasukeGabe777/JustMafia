'use strict';
// JustKingdoms: every table of the game (terrain, buildings, units, ages, techs, events, names).
// Pure data: the rules live in kingdoms.js, the map in kingdoms-map.js, the bots in kingdoms-ai.js.

const RES = ['food', 'wood', 'stone', 'gold', 'sci'];
const RES_ICON = { food: '🌾', wood: '🪵', stone: '🪨', gold: '🪙', sci: '🔬' };

// Terrain codes (the `t` of a tile). `job` = the job whose output the tile boosts.
const TERRAIN = {
  p: { name: 'Plains', icon: '🌾', job: 'farm', pass: true },
  f: { name: 'Forest', icon: '🌲', job: 'chop', pass: true },
  h: { name: 'Hills', icon: '⛰️', job: 'quarry', pass: true, def: 0.15 },
  g: { name: 'Gold vein', icon: '✨', job: 'mine', pass: true },
  l: { name: 'Lake', icon: '💧', pass: false },
  m: { name: 'Mountains', icon: '🏔️', pass: false },
  r: { name: 'Ancient Ruins', icon: '🏛️', pass: true, ruins: true },
};
const TERRAIN_WEIGHTS = [['p', 30], ['f', 25], ['h', 18], ['g', 7], ['l', 10], ['m', 10]];

// Jobs: what peasants do. `need` = what unlocks the job.
const JOBS = {
  farm: { res: 'food', terrain: 'p', name: 'Farm', icon: '🌾', bld: 'farm', tech: 'plows' },
  chop: { res: 'wood', terrain: 'f', name: 'Chop', icon: '🪵', bld: 'lumber', tech: 'saws' },
  quarry: { res: 'stone', terrain: 'h', name: 'Quarry', icon: '🪨', bld: 'quarry', age: 2 },
  mine: { res: 'gold', terrain: 'g', name: 'Mine', icon: '🪙', bld: 'mine', age: 3, tech: 'banking' },
  study: { res: 'sci', name: 'Study', icon: '🔬', needBld: 'library' },
};
const JOB_KEYS = Object.keys(JOBS);
const BASE_YIELD = 0.6, STUDY_YIELD = 0.3, TILE_BONUS = 0.25;
const FOOD_PEASANT = 0.1, FOOD_SOLDIER = 0.2;

// Ages: the Castle level. cost/time to REACH that age.
const AGES = [
  null,
  { n: 1, name: 'Hamlet', icon: '🛖', cost: {}, time: 0 },
  { n: 2, name: 'Village', icon: '🏘️', cost: { food: 150, wood: 150 }, time: 40 },
  { n: 3, name: 'Town', icon: '🏰', cost: { food: 300, wood: 250, stone: 200 }, time: 60 },
  { n: 4, name: 'City', icon: '🏙️', cost: { food: 500, wood: 400, stone: 400, gold: 300 }, time: 80 },
  { n: 5, name: 'Kingdom', icon: '👑', cost: { food: 800, wood: 800, stone: 800, gold: 800, sci: 300 }, time: 100 },
];

// Buildings (in the capital). cost ×1.8 per level, time (s) = BUILD_TIME[age] × 1.4^(level-1).
const BUILDINGS = {
  farm: { name: 'Farm', icon: '🌾', age: 1, cost: { wood: 40 }, max: 3, about: '+20% food per level' },
  houses: { name: 'Houses', icon: '🏠', age: 1, cost: { wood: 50 }, max: 3, about: '+4 population cap per level' },
  lumber: { name: 'Lumber Camp', icon: '🪓', age: 1, cost: { wood: 40 }, max: 3, about: '+20% wood per level' },
  quarry: { name: 'Quarry', icon: '🪨', age: 2, cost: { wood: 60 }, max: 3, about: '+20% stone per level' },
  barracks: { name: 'Barracks', icon: '⚔️', age: 2, cost: { wood: 80, stone: 40 }, max: 3, about: 'Trains Spearmen; −10% training time per level' },
  walls: { name: 'Walls', icon: '🧱', age: 2, cost: { stone: 100 }, max: 3, about: 'Capital defence +25% per level' },
  mine: { name: 'Mine', icon: '⛏️', age: 3, cost: { wood: 80, stone: 80 }, max: 3, about: '+20% gold per level' },
  archery: { name: 'Archery Range', icon: '🏹', age: 3, cost: { wood: 120 }, max: 3, about: 'Trains Archers; −10% their training time per level' },
  market: { name: 'Market', icon: '⚖️', age: 3, cost: { wood: 100, gold: 50 }, max: 3, about: 'Trade with the market (3:1 → 2:1) and send gifts' },
  library: { name: 'Library', icon: '📚', age: 3, cost: { wood: 120, stone: 60 }, max: 3, about: 'Unlocks studying and research; +20% science per level' },
  tower: { name: 'Watchtower', icon: '🗼', age: 3, cost: { stone: 80 }, max: 1, about: 'See attacks coming as soon as they march; +10% capital defence' },
  stable: { name: 'Stable', icon: '🐎', age: 4, cost: { wood: 150, gold: 100 }, max: 3, about: 'Trains Knights' },
  workshop: { name: 'Workshop', icon: '🛠️', age: 4, cost: { wood: 200, stone: 100 }, max: 3, about: 'Trains Catapults' },
  university: { name: 'University', icon: '🎓', age: 4, cost: { stone: 200, gold: 150 }, max: 3, about: '+40% science per level; research 15% faster per level' },
  observatory: { name: 'Observatory', icon: '🔭', age: 5, cost: { stone: 300, gold: 200 }, max: 1, about: 'Unlocks Rocketry research; +25% science' },
  launchpad: { name: 'Launch Pad', icon: '🚀', age: 5, cost: { stone: 600, gold: 400, wood: 300 }, max: 1, about: 'Build the rocket (science win)', needTech: 'rocketry', science: true },
};
const BUILD_TIME = [0, 20, 30, 40, 50, 60];
const COST_GROWTH = 1.8, TIME_GROWTH = 1.4, BUILD_QUEUE = 3, TRAIN_QUEUE = 5;

// Units. speed = seconds per hex. `vs` = counter bonus against a unit kind; `walls` = bonus vs walls.
const UNITS = {
  peasant: { name: 'Peasant', icon: '🧑‍🌾', age: 1, cost: { food: 30 }, time: 8, atk: 1, def: 1, speed: 6, worker: true },
  scout: { name: 'Scout', icon: '🔭', age: 1, cost: { food: 20, wood: 20 }, time: 8, atk: 0, def: 1, speed: 2, noFight: true },
  settlers: { name: 'Settlers', icon: '🛻', age: 2, cost: { food: 80, wood: 60 }, time: 15, atk: 0, def: 1, speed: 5, noFight: true },
  militia: { name: 'Militia', icon: '🗡️', age: 1, cost: { food: 30, wood: 15 }, time: 10, atk: 3, def: 3, speed: 5 },
  spear: { name: 'Spearman', icon: '🔱', age: 2, cost: { food: 40, wood: 25 }, time: 12, atk: 4, def: 6, speed: 5, vs: { knight: 2 }, bld: 'barracks' },
  archer: { name: 'Archer', icon: '🏹', age: 3, cost: { food: 35, wood: 35, gold: 10 }, time: 12, atk: 6, def: 3, speed: 5, vs: { spear: 2 }, bld: 'archery' },
  knight: { name: 'Knight', icon: '🐎', age: 4, cost: { food: 60, gold: 40 }, time: 16, atk: 9, def: 7, speed: 3, vs: { archer: 2 }, bld: 'stable' },
  catapult: { name: 'Catapult', icon: '☄️', age: 4, cost: { wood: 120, stone: 80 }, time: 25, atk: 12, def: 2, speed: 8, walls: 3, bld: 'workshop' },
  guard: { name: 'Royal Guard', icon: '🛡️', age: 5, cost: { food: 80, gold: 80 }, time: 20, atk: 10, def: 12, speed: 4, bld: 'barracks' },
};
const SOLDIERS = Object.keys(UNITS).filter((u) => !UNITS[u].worker);
const FIGHTERS = SOLDIERS.filter((u) => !UNITS[u].noFight);

// Research: three tracks of four. cost/time by tier; tiers 3–4 need a University.
const TECH_COST = [60, 120, 200, 320], TECH_TIME = [30, 40, 50, 60];
const TECHS = {
  plows: { track: 'economy', tier: 0, name: 'Better Plows', icon: '🌾', about: '+15% food' },
  saws: { track: 'economy', tier: 1, name: 'Saws', icon: '🪚', about: '+15% wood' },
  masonry: { track: 'economy', tier: 2, name: 'Masonry', icon: '🧱', about: '−15% stone costs' },
  banking: { track: 'economy', tier: 3, name: 'Banking', icon: '🏦', about: '+20% gold' },
  tactics: { track: 'war', tier: 0, name: 'Tactics', icon: '🗺️', about: '+10% attack' },
  shields: { track: 'war', tier: 1, name: 'Shields', icon: '🛡️', about: '+10% defence' },
  engineering: { track: 'war', tier: 2, name: 'Engineering', icon: '📐', about: '+1 wall level cap' },
  logistics: { track: 'war', tier: 3, name: 'Logistics', icon: '🐴', about: '+25% march speed' },
  writing: { track: 'science', tier: 0, name: 'Writing', icon: '✍️', about: '+20% science' },
  astronomy: { track: 'science', tier: 1, name: 'Astronomy', icon: '🌌', about: '+20% science' },
  physics: { track: 'science', tier: 2, name: 'Physics', icon: '⚛️', about: 'Rocket stages cost 20% less' },
  rocketry: { track: 'science', tier: 3, name: 'Rocketry', icon: '🚀', about: 'Enables the Launch Pad (needs an Observatory)', needBld: 'observatory' },
};
const TRACKS = { economy: ['plows', 'saws', 'masonry', 'banking'], war: ['tactics', 'shields', 'engineering', 'logistics'], science: ['writing', 'astronomy', 'physics', 'rocketry'] };

// The rocket: 3 stages, each 60 s.
const ROCKET = [null, { wood: 200, stone: 400, gold: 300, sci: 100 }, { wood: 300, stone: 600, gold: 450, sci: 150 }, { wood: 400, stone: 800, gold: 600, sci: 200 }];
const ROCKET_TIME = 60;
const MONUMENT_PER_KINGDOM = 250; // gold+stone needed per kingdom in the world

// Village upgrades (level → next) and village walls.
const VILLAGE_UP = [null, { wood: 100, stone: 60 }, { wood: 180, stone: 120 }];
const VILLAGE_WALL = [{ stone: 60 }, { stone: 110 }, { stone: 180 }];

// World events (every ~3 minutes when on).
const EVENTS = {
  harvest: { name: 'Bountiful Harvest', icon: '🌽', text: 'Bountiful Harvest! Every kingdom gets extra food.' },
  plague: { name: 'Plague', icon: '🤢', text: 'Plague! Kingdoms without a Library lose some peasants.' },
  bandits: { name: 'Bandits', icon: '🏴‍☠️', text: 'Bandits are raiding the weakest village!' },
  goldrush: { name: 'Gold Rush', icon: '✨', text: 'Gold Rush! Gold veins count double for 60 seconds.', secs: 60 },
  comet: { name: 'Comet', icon: '☄️', text: 'A comet lights the sky! Scholars everywhere learn something.' },
};

// Preset messages (shown on the TV next to your castle for ~8 s).
const PRESETS = {
  peace: '🤝 Peace?', next: '⚔️ You’re next', help: '🙏 Help!', thanks: '💐 Thank you!', deal: '🤝 Deal?',
  sorry: '😅 Sorry!', watch: '👀 I’m watching you', gg: '👑 Long live the king!',
};

const PERSONALITIES = {
  builder: { name: 'Builder', icon: '🏗️' }, warlord: { name: 'Warlord', icon: '⚔️' },
  diplomat: { name: 'Diplomat', icon: '🕊️' }, scholar: { name: 'Scholar', icon: '🔬' },
};
const BANDIT_NAMES = ['the Red Hoods', 'the Mud Rats', 'the Night Crows', 'the Grey Wolves', 'the Bog Boys'];

module.exports = {
  RES, RES_ICON, TERRAIN, TERRAIN_WEIGHTS, JOBS, JOB_KEYS, BASE_YIELD, STUDY_YIELD, TILE_BONUS, FOOD_PEASANT, FOOD_SOLDIER,
  AGES, BUILDINGS, BUILD_TIME, COST_GROWTH, TIME_GROWTH, BUILD_QUEUE, TRAIN_QUEUE, UNITS, SOLDIERS, FIGHTERS,
  TECH_COST, TECH_TIME, TECHS, TRACKS, ROCKET, ROCKET_TIME, MONUMENT_PER_KINGDOM, VILLAGE_UP, VILLAGE_WALL,
  EVENTS, PRESETS, PERSONALITIES, BANDIT_NAMES,
};
