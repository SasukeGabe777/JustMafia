'use strict';
// JustRaiseDucks: every player gets a farm in Duck Valley (on the big screen) and raises a
// racing duck from their phone. Training mini-games level up Run, Swim, Fly, Climb, Stamina
// and Smarts; coins buy food, farm buildings, decorations, hats and race-day gear. Every few
// minutes the whole valley races a side-scrolling obstacle course on the TV: a track with
// hurdles, ponds, cliffs to climb, ravines to fly over and mazes to find a way through, in a
// dozen landscapes (meadow, beach, forest, snow, canyon, night, volcano, swamp, rooftops,
// jungle, desert, sky islands, candy land, a haunted farm). Weather, tactics, mood, farm
// events, predictions and badges keep every minute busy.
const SKILLS = ['run', 'swim', 'fly', 'climb', 'stamina', 'smarts'];
const GAME_FOR = { run: 'hurdles', swim: 'paddle', fly: 'rings', climb: 'climb', stamina: 'bugs', smarts: 'maze' };
// Section lengths (metres) are short enough that a race plays at about real speed on the TV
// (30-60 s), so every jump, splash and climb can be animated instead of fast-forwarded.
// Skill balance (measured by tools/ducks-balance.js, checked in tools/test-box-ducks.js):
//  - Every course has every kind of section (track, pond, cliff, ravine, maze), and each one
//    takes about the same time, so each skill is worth about the same.
//  - Every skill speeds up its own section by the same curve, SKILL_SPEED: the first levels count
//    the most (a skill at 0 is a real bottleneck: that section takes about twice as long) and the
//    last ones the least (diminishing returns), so a duck that pours everything into one skill
//    loses to a well-rounded duck with the same total.
//  - Each section also has its own mishap, rarer the better trained the duck is (MISHAP / speed²):
//    tripping on a hurdle (Run), swallowing water (Swim), dipping into the ravine (Fly), slipping
//    down the cliff (Climb), a wrong turn in the maze (Smarts).
//  - Stamina is the late race: every duck tires over the last part of every race (FATIGUE); the
//    better its Stamina, the less it slows down.
const SKILL_SPEED = (lv) => 1 + 0.3 * Math.pow(Math.max(0, lv), 0.65);
// v0: speed (m/s) at level 0; a level-5 duck goes ~1.85× that.
const SECTIONS = { track: { skill: 'run', len: 38, v0: 2.9 }, pond: { skill: 'swim', len: 32, v0: 2.5 }, cliff: { skill: 'climb', len: 26, v0: 2.0 }, gap: { skill: 'fly', len: 32, v0: 2.2 }, maze: { skill: 'smarts', len: 34, v0: 2.6 } };
// Cliffs are climbing walls: WALL.steps sheer walls (each WALL.rise of a step, over the first
// WALL.face of the section; public/box/games/ducks-art.js draws the same shape) with flat ledges
// between. On a wall a duck climbs hand over hand at WALL.speed of its pace, so it really takes time
// (Climb sets how fast); the cliff's v0 is set so the whole section takes as long as the others.
const WALL = { face: 0.78, steps: 2, rise: 0.12, speed: 0.28 };
WALL.share = WALL.face * WALL.rise; // the part of a cliff that is wall
const onWall = ([a, b], x) => { const f = (x - a) / (b - a); if (f < 0 || f >= WALL.face) return false; const p = (f / WALL.face) * WALL.steps; return p - Math.floor(p) < WALL.rise; };
// Section lengths on this course (Sprint courses are shorter; older courses have none: the defaults).
const courseLen = (C) => (C && C.secLen) || Object.fromEntries(Object.entries(SECTIONS).map(([k, x]) => [k, x.len]));
// The section each skill races on (Stamina has none: it is the late race).
const SEC_OF = { run: 'track', swim: 'pond', fly: 'gap', climb: 'cliff', smarts: 'maze' };
const sectionSpeed = (type, lv) => SECTIONS[type].v0 * SKILL_SPEED(lv);
// Mishap odds for a skill at level lv (base p at level 0).
const mishap = (p, lv) => p / Math.pow(SKILL_SPEED(lv), 2);
// Stamina: from FATIGUE.from of the course (earlier on long courses) a duck slows down, a little
// more every metre (over FATIGUE.ramp of the course), down to 1 - depth of its speed. The depth
// follows the same skill curve as every other skill: about half its speed at Stamina 0, less and
// less with every level, nothing left at the top level. A tired duck (depth past FATIGUE.tired)
// shows it: sweat, a heavy waddle and the commentary.
const FATIGUE = { from: 0.5, fromLong: 0.4, fromEndurance: 0.15, ramp: 0.25, pow: 0.75, tired: 0.25 };
// Where the late race starts on a course (a share of its length): a trek tires the ducks earliest,
// then a Stamina race, then long courses.
const fatStart = (C) => (C.trek ? TREK.from : C.endurance ? FATIGUE.fromEndurance : C.sections.length >= 8 ? FATIGUE.fromLong : FATIGUE.from);
const fatigueDepth = (stamina, { bar = false, lungs = false, tactic = 'steady', heat = false, low = false } = {}) =>
  clamp((1 - Math.pow(SKILL_SPEED(stamina + (bar ? 3 : 0)) / SKILL_SPEED(25), FATIGUE.pow)) * (lungs ? 0.6 : 1) * (tactic === 'sprint' ? 1.35 : tactic === 'steady' ? 0.85 : 1) * (heat ? 1.3 : 1) * (low ? 1.2 : 1), 0, 0.75);
// Jumps: how long a crashed duck sits dazed, and how long a clipped hurdle slows it.
const TRIP_STOP = 1.2, CLIP_SLOW = 0.6;
// Ponds and ravines: a weak swimmer swallows water / a weak flyer dips into the ravine and has to
// flap back up: it stops for a moment (GULP_STOP / DIP_STOP seconds).
const GULP_STOP = 1.0, DIP_STOP = 1.0;
const MISHAP = { trip: 0.3, clip: 0.28, gulp: 0.36, dip: 0.4, slip: 0.36, skid: 0.35, wrong: 0.32 };
// A skill this far below the duck's own average (or at 0-1) is "weak": the race commentary says so
// when the duck reaches that section, and the phone points at it.
const WEAK_GAP = 3;
// Mazes: a fork every FORK_GAP metres. At each one a duck takes the shortcut (a burst of speed),
// stops to think (THINK_STOP seconds, head-scratching) or takes a wrong turn and walks back to the
// fork (WRONG_STOP seconds). Smarts sets the odds; it is decided in the simulation, like a hurdle.
// Balance (tools/test-box-ducks.js measures it): Smarts only matters inside mazes, and the fork odds
// level off (diminishing returns), so a level of Smarts buys about what a level of Run, Swim or Climb
// buys on the default course. The Maze Map and the Inner Compass each cut wrong turns, never to zero.
const FORK_GAP = 11, THINK_STOP = 0.7, WRONG_STOP = 2.0, SHORT_BOOST = 1.2, SHORT_SPEED = 1.25;
// (fog: true for the fog's 1.4, or the weather's own multiplier: wfx(weather, 'wrong'))
const forkOdds = (smarts, map, compass, fog, wx = 1) => {
  const wrong = mishap(MISHAP.wrong, smarts) * (map ? 0.5 : 1) * (compass ? 0.7 : 1) * (fog ? 1.4 : 1) * wx;
  const short = 0.1 + 0.4 * (1 - 1 / SKILL_SPEED(smarts));
  return { wrong, short: Math.min(short, 1 - wrong) };
};
// Where the forks are in a maze section that runs from a to b (metres).
const forksIn = (a, b) => { const out = []; for (let x = a + 7; x < b - 5; x += FORK_GAP) out.push(x); return out; };
const COLORS = ['sunny', 'snow', 'cocoa', 'mallard', 'bubblegum', 'sky', 'midnight', 'mint', 'ember', 'lilac'];
const HATS = ['none', 'cap', 'tophat', 'crown', 'flower', 'shades', 'bow', 'viking', 'pirate', 'party', 'chef', 'headband'];
// Food: three sizes, small to big, bought right on the training screen (or in the shop). Food only
// restores energy. A tap feeds one: from the pantry if you have some, else it buys one. A full duck
// can't eat, so what you buy then goes into the pantry (up to PANTRY_MAX of each) for later.
const FOOD = {
  seeds: { label: 'Seeds', icon: '🌾', cost: 5, energy: 20, about: '+20 energy' },
  corn: { label: 'Corn Cob', short: 'Corn', icon: '🌽', cost: 12, energy: 45, about: '+45 energy' },
  feast: { label: 'Feast Bowl', short: 'Feast', icon: '🥗', cost: 28, energy: 100, about: 'Fills energy all the way up' },
};
const PANTRY_MAX = 9;
// Foods from older versions (they also gave mood or XP): anything left in a pantry becomes the new
// food closest in price.
const OLD_FOOD = { berries: 'corn', worms: 'corn', walnuts: 'corn', cake: 'feast', clover: 'feast' };
const GEAR = {
  sneakers: { label: 'Track Sneakers', icon: '👟', cost: 20, about: 'Never trip on a hurdle (next race)' },
  flippers: { label: 'Flippers', icon: '🦶', cost: 20, about: '+10% swimming speed (next race)' },
  glider: { label: 'Glider Wings', icon: '🪁', cost: 20, about: '+10% flying speed (next race)' },
  claws: { label: 'Climbing Claws', icon: '🧗', cost: 20, about: '+10% climbing, half the slips (next race)' },
  energybar: { label: 'Energy Bar', icon: '🍫', cost: 25, about: 'Bigger stamina tank (next race)' },
  map: { label: 'Maze Map', icon: '🗺️', cost: 20, about: 'Half as many wrong turns in a maze (next race)' },
};
const BUILDINGS = {
  track: { label: 'Running Track', icon: '🏟️', skill: 'run', about: '+20% Run XP per level' },
  pool: { label: 'Lap Pool', icon: '🏊', skill: 'swim', about: '+20% Swim XP per level' },
  tower: { label: 'Wind Tower', icon: '🌬️', skill: 'fly', about: '+20% Fly XP per level' },
  wall: { label: 'Climbing Wall', icon: '🧗', skill: 'climb', about: '+20% Climb XP per level' },
  garden: { label: 'Bug Garden', icon: '🌻', skill: 'stamina', about: '+20% Stamina XP per level' },
  hedge: { label: 'Hedge Maze', icon: '🧩', skill: 'smarts', about: '+20% Smarts XP per level' },
  coop: { label: 'Cozy Coop', icon: '🛖', about: 'Naps are shorter and give more energy' },
  feeder: { label: 'Auto Feeder', icon: '🥣', about: 'Energy refills faster on its own' },
};
const BUILD_COST = [40, 90, 160];
const DECOR = { flowers: ['🌷', 'Flower bed', 15], flag: ['🚩', 'Team flag', 15], gnome: ['🧙', 'Garden gnome', 20], lantern: ['🏮', 'Lanterns', 20], scarecrow: ['🎃', 'Scarecrow', 25], fountain: ['⛲', 'Fountain', 40], statue: ['🗿', 'Duck statue', 60], rainbow: ['🌈', 'Rainbow arch', 80] };
// Weather: every race has its own, picked per world (WEATHER_ODDS: the desert gets heat and
// sandstorms and hardly ever rain, the Sky Islands are windy, the swamp foggy, the peaks snowy, the
// volcano hot and ashy) from the room's seed. Effects are modest (a few %): speed on each kind of
// section (run/swim/climb/fly), more trips on wet hurdles (trip), more slips on wet rock (slip), more
// wrong turns when you can't see (wrong), tiring faster (tire); wind = a tail- or headwind over the
// ravines (strong flyers ride a tailwind further, weak ones get pushed back by a headwind).
// tip: what the next-race card and the phones say, so players can train for it.
const WEATHER = {
  sunny: { icon: '☀️', label: 'Clear', about: 'Perfect racing weather.', tip: 'Clear skies: a fair race for everyone.' },
  rain: { icon: '🌧️', label: 'Rain', about: 'Faster ponds, slippery hurdles and rock, a little slower running.', tip: 'Rain expected: swimmers rejoice! Runners and climbers, watch your step.', swim: 1.05, run: 0.97, trip: 1.4, slip: 1.4 },
  windy: { icon: '💨', label: 'Windy', about: 'A tailwind or headwind over the ravines.', tip: 'Wind over the ravines: strong flyers love it.', wind: true },
  heat: { icon: '🥵', label: 'Heatwave', about: 'Every duck tires faster.', tip: 'Heatwave: every duck tires faster. Stamina counts!', tire: 1.25 },
  fog: { icon: '🌫️', label: 'Fog', about: 'Nobody can see a thing: a bit more luck, and more wrong turns in mazes.', tip: 'Fog: easy to get lost in a maze. Smarts counts!', wrong: 1.4, luck: true },
  snow: { icon: '❄️', label: 'Snow', about: 'Slow running, cold water, and ducks tire a little faster.', tip: 'Snow: slow running and icy water. Stamina helps.', run: 0.95, swim: 0.95, slip: 1.2, tire: 1.1 },
  storm: { icon: '⛈️', label: 'Storm', about: 'Rain and wind at once: slippery, splashy, gusty.', tip: 'Storm: rain AND wind. Hold on to your feathers!', swim: 1.03, run: 0.96, trip: 1.5, slip: 1.5, wind: true },
  sandstorm: { icon: '🏜️', label: 'Sandstorm', about: 'Sand in the eyes: slower running and flying, mazes hard to read.', tip: 'Sandstorm: slow running, and mazes are hard to read.', run: 0.96, fly: 0.96, wrong: 1.3 },
  ash: { icon: '🌋', label: 'Ash cloud', about: 'Smoky air: mazes are hard to see and ducks tire a little faster.', tip: 'Ash cloud: smoky mazes, and ducks tire faster.', wrong: 1.3, tire: 1.1 },
};
const WEATHER_ODDS = {
  meadow: { sunny: 5, rain: 3, windy: 2, heat: 1, fog: 1, storm: 0.5 }, beach: { sunny: 5, windy: 3, heat: 2, rain: 1.5, fog: 1, storm: 1 },
  forest: { sunny: 4, rain: 3, fog: 2, windy: 1, storm: 0.5 }, snow: { sunny: 3, snow: 5, windy: 2, fog: 1, storm: 0.5 },
  canyon: { sunny: 4, heat: 3, windy: 3, sandstorm: 1, rain: 0.5 }, night: { sunny: 5, fog: 3, rain: 2, windy: 1 },
  volcano: { sunny: 3, heat: 4, ash: 3, windy: 1 }, swamp: { sunny: 2.5, fog: 6, rain: 2, heat: 1, storm: 0.5 },
  city: { sunny: 4, rain: 3, windy: 2, fog: 1, storm: 1 }, jungle: { sunny: 3, rain: 5, heat: 2, fog: 1, storm: 1 },
  desert: { sunny: 4, heat: 5, sandstorm: 3, windy: 1, rain: 0.3 }, sky: { sunny: 4, windy: 5, storm: 1, fog: 1 },
  candy: { sunny: 6, rain: 2, windy: 1, snow: 1 }, haunted: { sunny: 2, fog: 5, rain: 2, storm: 1.5, windy: 1 },
};
// Now and then (WEATHER_TURN) the weather turns mid-race, somewhere in the middle of the course: a
// clear or windy day turns to the world's worst (a downpour, a blizzard, a sandstorm), a bad one clears.
const WEATHER_TURN = 0.12;
const TURN_SAY = { rain: '🌧️ A downpour starts!', storm: '⛈️ A storm blows in!', snow: '❄️ It starts to snow!', sandstorm: '🏜️ A sandstorm whips up!', fog: '🌫️ Fog rolls in!', ash: '🌋 An ash cloud drifts over!', sunny: '☀️ The sky clears up!' };
// The weather's effect on a race: one number per kind of effect (1 = none).
const wfx = (w, k) => { const W = WEATHER[w]; return W && W[k] != null ? W[k] : 1; };
const TACTICS = { steady: ['🐢', 'Steady', 'Saves stamina all race.'], sprint: ['🐇', 'Fast start', 'Faster early, but tires quicker.'], finish: ['🔥', 'Strong finish', 'Slow start, big burst at the end.'] };
const BADGES = {
  firstWin: ['🥇', 'First win', 25], podium: ['🏅', 'On the podium', 10], level5: ['⭐', 'Any skill level 5', 15], level10: ['🌟', 'Any skill level 10', 30],
  allround: ['🎯', 'Every skill level 3+', 30], builder: ['🔨', '3 farm buildings', 20], stylish: ['🎩', '3 hats', 10], oracle: ['🔮', 'Called the winner', 20],
  comeback: ['🚀', 'Top 3 after finishing last', 30], rich: ['💰', '300 coins at once', 0], happy: ['😊', 'Mood 100', 10], champion: ['🏆', 'Won the Grand Duckstakes', 50], goose: ['👑', 'Beat the Golden Goose', 40],
};
// Three quests each training period: small goals that pay coins.
const QUESTS = {
  train: { text: (q) => `Train ${q.skillName} ${q.n} times`, n: [2, 3], reward: 15 },
  score: { text: (q) => `Score ${q.n}+ in any mini-game`, n: [15, 20], reward: 15 },
  feed: { text: (q) => `Feed your duck ${q.n} times`, n: [2, 3], reward: 10 },
  pet: { text: (q) => `Pet your duck ${q.n} times`, n: [3, 4], reward: 8 },
  build: { text: () => 'Build or decorate something on your farm', n: [1, 1], reward: 12 },
  mood: { text: (q) => `Get your duck’s mood to ${q.n}`, n: [90, 95], reward: 10 },
  gear: { text: () => 'Pack some race-day gear', n: [1, 1], reward: 8 },
  gift: { text: () => 'Send a gift to a friend’s farm', n: [1, 1], reward: 10 },
  star: { text: (q) => `Hit the ⭐ target ${q.n} times`, n: [2, 3], reward: 15 },
};
const SKILL_NAME = { run: 'Run', swim: 'Swim', fly: 'Fly', climb: 'Climb', stamina: 'Stamina', smarts: 'Smarts' };
// Single-skill races: their banner.
const SOLO = { run: ['🏃', 'Foot Race'], swim: ['🌊', 'Swim Meet'], fly: ['🪽', 'Sky Dash'], climb: ['🧗', 'Cliff Scramble'], stamina: ['💪', 'Long Trek'], smarts: ['🧠', 'Maze Madness'] };
// Season planning (planSeason()): lean = how much less likely a skill is picked per race-share it is
// ahead of the least-featured skill; perRace = how many never-featured skills a later race can still
// take; maxShare/minShare = the most/least season share a skill may get (× the average) before the
// season is planned again (up to tries times).
const SEASON = { lean: 0.3, perRace: 3, maxShare: 1.9, minShare: 0.45, tries: 40 };
// Stamina-only races are long treks on flat trail: every duck walks at the pace of a level-TREK.lv
// duck (Run doesn't count, no hurdles) and tires from TREK.from of the course, so only Stamina counts.
const TREK = { lv: 6, from: 0.1 };
// Eggs: every duck hatches with a natural talent (+25% XP in one skill and a head start).
const EGGS = {
  run: { label: 'Speckled egg', color: '#f2c14e', spots: '#c47f17', about: 'A natural runner' },
  swim: { label: 'Ripple egg', color: '#9ad7ff', spots: '#3d8fd1', about: 'A natural swimmer' },
  fly: { label: 'Cloud egg', color: '#f4f4ff', spots: '#a9b4d6', about: 'A natural flyer' },
  climb: { label: 'Pebble egg', color: '#c9b8a6', spots: '#7a6552', about: 'A natural climber' },
  stamina: { label: 'Sturdy egg', color: '#c7f0a8', spots: '#5e9e3a', about: 'Never runs out of steam' },
  smarts: { label: 'Starry egg', color: '#d9ccff', spots: '#7b5fd1', about: 'A natural thinker' },
};
// Ducks grow up as their skills grow (total of all six levels).
const STAGES = [{ key: 'duckling', label: 'Duckling', from: 0 }, { key: 'young', label: 'Young duck', from: 12 }, { key: 'adult', label: 'Grown duck', from: 30 }, { key: 'champion', label: 'Champion duck', from: 60 }];
const LEAGUES = [
  { key: 'rookie', label: 'Rookie Cup', icon: '🥉', wild: 1 }, { key: 'meadow', label: 'Meadow League', icon: '🌼', wild: 3 },
  { key: 'river', label: 'River League', icon: '🌊', wild: 5 }, { key: 'peak', label: 'Peak League', icon: '⛰️', wild: 8 },
  { key: 'sky', label: 'Sky League', icon: '☁️', wild: 11 }, { key: 'grand', label: 'Grand Championship', icon: '🏆', wild: 14 },
];
// Course themes (the 14 worlds) change the look and the obstacles: each section gets a variant.
// skills: how much each skill fits the world's scenery (a volcano is cliffs and lava pits to fly,
//   a swamp is murky water and reed mazes, Sky Islands is all open sky): a race there features its
//   skills, picked by these weights (and the season's balance, planSeason()).
// counts: how many skills a race there features, 1 to 6 (weights): Sky Islands is often a Fly-only
//   dash, Candy Land often an all-rounder course.
// weights: the kinds of section on the Track only / Pond only / Mountain terrains (no season plan).
const THEMES = {
  meadow: { label: 'Sunny Meadow', skills: { run: 3, swim: 3, fly: 1, climb: 1, stamina: 2.5, smarts: 1.5 }, counts: [1.5, 3, 3, 2, 1, 0.5], weights: { track: 2, pond: 2, cliff: 1, gap: 1, maze: 1 }, variants: { track: ['hurdles', 'mud'], pond: ['lily', 'calm'], cliff: ['rock', 'haystack'], gap: ['clouds', 'bridge'], maze: ['hedge'] } },
  beach: { label: 'Seashell Beach', skills: { run: 2.5, swim: 4.5, fly: 1, climb: 0.5, stamina: 2.5, smarts: 1 }, counts: [3, 3, 2, 1, 0.3, 0], weights: { track: 1, pond: 3, cliff: 1, gap: 1, maze: 1 }, variants: { track: ['sand', 'hurdles'], pond: ['waves'], cliff: ['rock'], gap: ['clouds', 'river'], maze: ['sandcastle'] } },
  forest: { label: 'Mossy Forest', skills: { run: 2.5, swim: 1, fly: 1, climb: 3, stamina: 1, smarts: 2.5 }, counts: [1.5, 3, 3, 2, 0.5, 0.3], weights: { track: 2, pond: 1, cliff: 2, gap: 1, maze: 2 }, variants: { track: ['logs', 'mud'], pond: ['lily', 'calm'], cliff: ['rock', 'vines'], gap: ['canyon', 'bridge'], maze: ['hedge'] } },
  snow: { label: 'Frosty Peaks', skills: { run: 1, swim: 0.5, fly: 1, climb: 3.5, stamina: 3.5, smarts: 1 }, counts: [3, 3, 2, 1, 0.3, 0], weights: { track: 1, pond: 1, cliff: 3, gap: 1, maze: 1 }, variants: { track: ['ice', 'hurdles'], pond: ['icy'], cliff: ['ice'], gap: ['canyon', 'river'], maze: ['icecave'] } },
  canyon: { label: 'Red Rock Canyon', skills: { run: 1, swim: 0.5, fly: 3.5, climb: 3, stamina: 1, smarts: 1.5 }, counts: [3, 3, 2, 1, 0.3, 0], weights: { track: 1, pond: 1, cliff: 2, gap: 3, maze: 1 }, variants: { track: ['hurdles', 'logs'], pond: ['rapids'], cliff: ['rock'], gap: ['canyon'], maze: ['slot'] } },
  night: { label: 'Firefly Night', skills: { run: 1.5, swim: 2.5, fly: 2.5, climb: 1, stamina: 1, smarts: 2 }, counts: [1.5, 2, 3, 3, 1, 0.5], weights: { track: 1, pond: 2, cliff: 1, gap: 2, maze: 1 }, variants: { track: ['hurdles', 'logs'], pond: ['lily', 'calm'], cliff: ['rock'], gap: ['clouds', 'bridge'], maze: ['hedge'] } },
  volcano: { label: 'Volcano Run', skills: { run: 1.5, swim: 0.5, fly: 3.5, climb: 3.5, stamina: 1.5, smarts: 1 }, counts: [1.5, 4, 3, 1, 0.3, 0], weights: { track: 2, pond: 1, cliff: 2, gap: 2, maze: 1 }, variants: { track: ['lava', 'ash'], pond: ['hotspring'], cliff: ['basalt'], gap: ['lavapit'], maze: ['lavatubes'] } },
  swamp: { label: 'Murky Swamp', skills: { run: 1, swim: 3.5, fly: 1, climb: 0.5, stamina: 1, smarts: 3.5 }, counts: [1.5, 4, 3, 1, 0.3, 0], weights: { track: 1, pond: 3, cliff: 1, gap: 1, maze: 2 }, variants: { track: ['roots', 'mud'], pond: ['murky'], cliff: ['mudbank'], gap: ['bog', 'river'], maze: ['reeds'] } },
  city: { label: 'City Rooftops', skills: { run: 3, swim: 0.5, fly: 3, climb: 3, stamina: 1, smarts: 1.5 }, counts: [1, 2, 4, 3, 1, 0.3], weights: { track: 2, pond: 1, cliff: 2, gap: 3, maze: 2 }, variants: { track: ['roof', 'puddles'], pond: ['fountain'], cliff: ['wall'], gap: ['street'], maze: ['alley'] } },
  jungle: { label: 'Lost Jungle', skills: { run: 1, swim: 3, fly: 1, climb: 3, stamina: 1, smarts: 3 }, counts: [1, 2, 4, 3, 1, 0.3], weights: { track: 1, pond: 2, cliff: 2, gap: 1, maze: 2 }, variants: { track: ['roots', 'mud'], pond: ['rapids'], cliff: ['waterfall', 'vines'], gap: ['gorge', 'river'], maze: ['temple'] } },
  desert: { label: 'Dusty Desert', skills: { run: 3.5, swim: 0.3, fly: 1, climb: 1, stamina: 3.5, smarts: 1 }, counts: [3, 4, 2, 1, 0.3, 0], weights: { track: 2, pond: 1, cliff: 1, gap: 2, maze: 2 }, variants: { track: ['cactus', 'dunes'], pond: ['oasis'], cliff: ['sandstone'], gap: ['canyon'], maze: ['slot'] } },
  sky: { label: 'Sky Islands', skills: { run: 0.5, swim: 0.5, fly: 6, climb: 1, stamina: 0.5, smarts: 0.5 }, counts: [6, 4, 1, 0.3, 0, 0], weights: { track: 1, pond: 1, cliff: 1, gap: 4, maze: 1 }, variants: { track: ['cloudpath', 'hurdles'], pond: ['skylake'], cliff: ['floating'], gap: ['sky'], maze: ['cloudmaze'] } },
  candy: { label: 'Candy Land', skills: { run: 2, swim: 2, fly: 2, climb: 2, stamina: 2, smarts: 2 }, counts: [0.2, 0.5, 1, 2, 3, 3], weights: { track: 2, pond: 2, cliff: 1, gap: 1, maze: 2 }, variants: { track: ['gumdrops', 'taffy'], pond: ['choco'], cliff: ['candycane'], gap: ['cotton', 'bridge'], maze: ['licorice'] } },
  haunted: { label: 'Haunted Farm', skills: { run: 3, swim: 0.5, fly: 1, climb: 1, stamina: 1, smarts: 4 }, counts: [3, 4, 2, 1, 0.3, 0], weights: { track: 1, pond: 1, cliff: 1, gap: 1, maze: 3 }, variants: { track: ['hay', 'mud'], pond: ['foggy'], cliff: ['barn', 'haystack'], gap: ['fogpit', 'bridge'], maze: ['corn'] } },
};
const VARIANT = {
  hurdles: 'Hurdles: jump them (Run helps)', logs: 'Fallen logs: big jumps, more trips', mud: 'Mud: slows weak runners', sand: 'Soft sand: slower running', ice: 'Ice: slippery for everyone',
  lava: 'Lava streams: leap them or get a hot foot (Run helps)', ash: 'Ash fields: dusty, a little slower', roots: 'Tangled roots: big jumps, more trips', roof: 'Rooftops: chimneys to hop over',
  puddles: 'Puddles: splashy, slows weak runners', cactus: 'Cactus hurdles: jump or get prickled', dunes: 'Sand dunes: slower running', cloudpath: 'Cloud path: soft and springy (faster)',
  gumdrops: 'Gumdrop hurdles: bouncy jumps', taffy: 'Taffy road: sticky for weak runners', hay: 'Hay bales: big jumps',
  calm: 'Calm water', lily: 'Lily pads: hop for a little boost', waves: 'Waves: bumpy swimming', rapids: 'Rapids: fast water', icy: 'Icy water: slow and cold',
  hotspring: 'Hot spring: steamy and a little slow', murky: 'Murky water: floating logs give a boost', fountain: 'Fountain pool: calm, with water jets', oasis: 'Oasis: cool, calm water',
  skylake: 'Sky lake: clear and fast', choco: 'Chocolate river: thick and slow for weak swimmers', foggy: 'Foggy pond: calm but spooky',
  rock: 'Rock face', basalt: 'Basalt columns: steps of black rock', mudbank: 'Mud bank: slippery climbing', wall: 'Building wall: window ledges to climb', waterfall: 'Waterfall climb: wet and slippery',
  sandstone: 'Sandstone cliff', floating: 'Floating rocks: climb the stepping stones', candycane: 'Candy-cane cliff: sticky stripes', barn: 'Spooky barn: climb the old roof',
  bridge: 'Broken bridge: run out on the planks, then fly the gap!', river: 'River gap: fly over the rushing water (weak flyers get their feet wet)',
  vines: 'Vine wall: climb hand over hand up the vines', haystack: 'Hay-bale stack: scramble up the bales',
  clouds: 'Cloud updrafts: more boosts', canyon: 'Deep canyon', lavapit: 'Lava pit: hot updrafts (more boosts)', bog: 'Misty bog: a long glide', street: 'Gap between buildings: glide across!',
  gorge: 'Jungle gorge: vines and mist', sky: 'Open sky: big glides between islands (more updrafts)', cotton: 'Cotton-candy clouds: soft updrafts', fogpit: 'Foggy ravine',
  hedge: 'Hedge maze: find the way (Smarts helps)', sandcastle: 'Sandcastle maze: find the way (Smarts helps)', icecave: 'Ice caves: twisty tunnels (Smarts helps)', slot: 'Slot-canyon maze: narrow and winding (Smarts helps)',
  lavatubes: 'Lava tubes: glowing tunnels (Smarts helps)', reeds: 'Reed maze: tall swamp reeds (Smarts helps)', alley: 'Alley maze: dead ends everywhere (Smarts helps)', temple: 'Temple maze: ancient passages (Smarts helps)',
  cloudmaze: 'Cloud maze: puffy walls (Smarts helps)', licorice: 'Licorice maze: twisty candy walls (Smarts helps)', corn: 'Corn maze: tall stalks… and something moving (Smarts helps)',
};
// Jumps on track sections: the obstacle each variant puts across the lanes, how far apart, how hard.
const JUMPS = { hurdles: ['hurdle', 11, 1], logs: ['log', 15, 1.3], lava: ['lava', 13, 1.15], cactus: ['cactus', 12, 1.1], roof: ['chimney', 13, 1], roots: ['root', 14, 1.3], gumdrops: ['gumdrop', 11, 0.85], hay: ['hay', 14, 1.25] };
// Combined-skill sections: these variants need a second skill as well as the section's own, when the
// race features that skill too (in a race that doesn't, they are ordinary sections). The duck goes at
// the average of its two skill speeds, and the section's mishap (slip, gulp, dip, skid) follows the
// WEAKER of the two (a weak link); a maze that needs a second skill gets that skill's mishap spot.
//   a waterfall to climb (Climb+Swim), rapids with logs to hop (Swim+Run), a rooftop maze you fly
//   through (Smarts+Fly), a flooded reed maze (Smarts+Swim), dunes: a long uphill slog (Run+Stamina),
//   floating rocks with gaps to flap over (Climb+Fly), broken bridges (Fly+Run), a jungle gorge you
//   cross on the vines (Fly+Climb), rooftops with walls to scramble up (Run+Climb), a foggy ravine and
//   a foggy pond where you must find the way (Fly+Smarts, Swim+Smarts). Every skill is the second
//   skill about as often as it gives half its section away, so the season stays even.
const COMBO = { 'cliff:waterfall': 'swim', 'pond:rapids': 'run', 'maze:alley': 'fly', 'maze:reeds': 'swim', 'track:dunes': 'stamina', 'cliff:floating': 'fly', 'gap:bridge': 'run', 'gap:gorge': 'climb', 'track:roof': 'climb', 'gap:fogpit': 'smarts', 'pond:foggy': 'smarts' };
const COMBO_ODDS = 0.75; // how often a section picks its combined variant when the race features both skills
// A section's skills: its own and, on a combined section, the second one.
const secSkills = (s) => (s.mix ? [SECTIONS[s.type].skill, s.mix] : [SECTIONS[s.type].skill]);
// The speed factor on a section: its skill's SKILL_SPEED, or the average of both on a combined one.
const secSpeed = (s, lv) => (s.mix ? (SKILL_SPEED(lv[SECTIONS[s.type].skill]) + SKILL_SPEED(lv[s.mix])) / 2 : SKILL_SPEED(lv[SECTIONS[s.type].skill]));
// The level its mishaps use: the weaker of the two.
const secLevel = (s, lv) => (s.mix ? Math.min(lv[SECTIONS[s.type].skill], lv[s.mix]) : lv[SECTIONS[s.type].skill]);
// What share of a planned race each skill gets (sums to 1), as the season planner counts it: the
// featured skills share the course evenly (Stamina, the late race, counts as one more share); a
// section that is often combined (COMBO, COMBO_ODDS) gives about half its share to its second skill.
function raceShares(theme, skills, terrain) {
  const out = Object.fromEntries(skills.map((k) => [k, 0])), T = THEMES[theme];
  const secs = skills.filter((k) => k !== 'stamina' && !(terrain === 'classic' && k === 'smarts'));
  if (!secs.length) { out.stamina = 1; return out; }
  const st = skills.includes('stamina') ? 1 / skills.length : 0, w = (1 - st) / secs.length;
  if (st) out.stamina += st;
  for (const k of secs) {
    const type = SEC_OF[k], vs = T.variants[type], combos = skills.length > 1 ? vs.filter((v) => COMBO[type + ':' + v] && skills.includes(COMBO[type + ':' + v])) : [];
    const cf = combos.length ? COMBO_ODDS + (1 - COMBO_ODDS) * (combos.length / vs.length) : 0;
    out[k] += w * (1 - cf / 2);
    for (const v of combos) out[COMBO[type + ':' + v]] += (w * cf) / 2 / combos.length;
  }
  return out;
}
// Extra boosts (lily pads, floating logs, updrafts) on these variants.
const MORE_BOOSTS = new Set(['clouds', 'lily', 'murky', 'lavapit', 'sky', 'cotton']);
const WILD = ['Puddles', 'Sir Waddles', 'Biscuit', 'Captain Quack', 'Noodle', 'Pepper', 'Marsh Mallow', 'Drizzle', 'Tumble', 'Pip Squeak', 'Ziggy', 'Rusty', 'Bramble', 'Coco'];
const NAMES = ['Puddle Cup', 'Reed Run', 'Pond Prix', 'Feather Derby', 'Lily Classic', 'Breadcrumb Bowl', 'Cattail Chase', 'Quackathon', 'Splash Open'];
// Training: every mini-game plays at one normal pace (⭐ target: TARGET). After a run you can RISK IT:
// one short round at the very hard pace (RISK.speed) with a goal shown up front. Meet the goal and
// the XP of the run you just played doubles; miss it and your duck falls over and keeps only half of
// that XP. A risk costs no extra energy. The goal is a share of the score you just made (RISK.share
// per game), between RISK.min and RISK.max, so it is hard for everyone.
const TARGET = 16;
const RISK = { seconds: 15, speed: 1.35, min: 6, max: 30, offerMs: 45000, share: { hurdles: 0.8, paddle: 0.7, rings: 0.8, climb: 0.7, bugs: 0.8, maze: 0.7 }, maxFor: { bugs: 50 } };
const riskGoal = (game, score) => clamp(Math.round(score * (RISK.share[game] || 0.75)), RISK.min, RISK.maxFor[game] || RISK.max);
// Perks: pick one each time your duck grows up. They change how it races.
const PERKS = {
  burst: { icon: '🚀', label: 'Rocket Start', about: '+15% speed for the first fifth of every race' },
  webbed: { icon: '🦶', label: 'Webbed Pro', about: '+8% speed in ponds' },
  feather: { icon: '🪶', label: 'Featherweight', about: '+8% speed over ravines' },
  grip: { icon: '🧲', label: 'Sure Grip', about: 'Never slips on cliffs' },
  lungs: { icon: '🫁', label: 'Iron Lungs', about: '+40% stamina tank' },
  lucky: { icon: '🍀', label: 'Lucky Feather', about: 'Catches boosts much more often' },
  nimble: { icon: '🦘', label: 'Nimble Feet', about: 'Half as many trips and skids' },
  compass: { icon: '🧭', label: 'Inner Compass', about: '30% fewer wrong turns in mazes' },
  closer: { icon: '🏁', label: 'Closer', about: '+10% speed in the last fifth of every race' },
};
// Lucky Spin: one free spin each training period.
const SPIN = [
  { w: 22, kind: 'coins', n: 10, label: '10 coins', icon: '🪙' }, { w: 14, kind: 'coins', n: 25, label: '25 coins', icon: '💰' }, { w: 4, kind: 'coins', n: 75, label: 'JACKPOT 75 coins', icon: '🎰' },
  { w: 16, kind: 'energy', n: 40, label: '+40 energy', icon: '⚡' }, { w: 14, kind: 'xp', n: 60, label: '+60 XP', icon: '⭐' }, { w: 10, kind: 'mood', n: 40, label: '+40 mood', icon: '😊' },
  { w: 8, kind: 'gear', label: 'Free race gear', icon: '🎒' }, { w: 6, kind: 'hat', label: 'A new hat', icon: '🎩' }, { w: 6, kind: 'nothing', label: 'A feather… nice?', icon: '🪶' },
];
// The boss race (setting, off by default): the Grand Championship gets one more racer, the Golden
// Goose, a big golden bird. Every skill at BOSS.mult × the best player duck's average level + BOSS.edge
// (so it keeps up with the room); tuned with tools/ducks-balance.js so the best duck of a typical
// season beats it about 35-50% of the time (more often with a few strong ducks in the room). It scores no season points (like a wild duck). If any player
// duck finishes ahead of it, every player gets BOSS.bonus coins and the ducks that beat it get the
// Goose Slayer badge and a 👑 trophy.
const BOSS = { name: 'The Golden Goose', color: 'gold', hat: 'crown', mult: 1, edge: 0, bonus: 50, stage: 4 };
const RUN_SECONDS = 20, TRAIN_COST = 15, NAP_SECONDS = 15, MAX_LEVEL = 25, SCORE_RATE = 3.2, SCORE_MAX = 60 /* combos let good players score more */;
// XP per point, per mini-game: the six games score differently for the same effort (combos, how
// many things come at you), so each pays its own rate. Measured with tools/ducks-minipay.js so that
// the same kind of player earns about the same XP in every game (no skill is cheaper to train).
const PAY = { hurdles: 0.9, paddle: 1.25, rings: 1.08, climb: 0.87, bugs: 0.4, maze: 0.84 };
// The XP floor: a full run where you really played (XP_FLOOR.minScore points or more) earns at least
// XP_FLOOR.xp base XP, so a player who finds the games hard still grows a duck. Good runs earn more.
const XP_FLOOR = { xp: 40, minScore: 3 };
// Quiet help per mini-game: a full run paying under ASSIST.low base XP (a struggling player) adds a
// step (up to ASSIST.max), one paying ASSIST.high or more takes one away. Each step slows the game by
// ASSIST.slow and widens its windows a little (public/box/games/ducks-mini.js, opts.assist).
const ASSIST = { low: 50, high: 80, max: 3, slow: 0.08 };
const SKILL_OF_GAME = Object.fromEntries(Object.entries(GAME_FOR).map(([k, g]) => [g, k]));
// The base XP of a run (before streak, buildings, mood, egg and catch-up): full = played to the end.
const baseXp = (stat, score, full) => Math.max(Math.round(score * 4 * (PAY[GAME_FOR[stat]] || 1)), full && score >= XP_FLOOR.minScore ? XP_FLOOR.xp : 0);
// When a race starts, a mini-game in progress stops at once: the phone sends what it scored up to
// that moment (its score counts, capped by the time played before the start) within RACE_GRACE ms.
const RACE_GRACE = 6000;
const RACE_INTRO = 5000, RACE_OUTRO = 6000, RESULT_SHOW = 10000;
// Race pacing on the TV: the winner crosses after about RACE_WIN seconds (the simulation plays at
// 0.85-2.2x speed), then the rest of the field comes home within RACE_TAIL more seconds.
const RACE_WIN = 34, RACE_TAIL = 9;
const POINTS = [10, 8, 6, 5, 4, 3, 2];
const PRIZE = [40, 30, 22, 16, 12];
const PET_COOLDOWN = 8000;
const HYPE_MS = 15000; // race-day hype: the last 15 seconds before the start
const CHEER_GAP = 150; // one cheer per 150 ms per phone (the TV shows each one)

// How the TV plays a race back (the phones use the same numbers): k = simulated seconds per real
// second until the winner crosses at tw seconds, then k2 until the last duck is home tail seconds
// later. run = the whole race on screen, in ms.
function racePace(entries) {
  const winT = entries.length ? entries[0].time : 1, lastT = entries.length ? entries[entries.length - 1].time : 1;
  const k = clamp(winT / RACE_WIN, 0.85, 2.2), tw = winT / k, rest = Math.max(0, lastT - winT);
  const tail = Math.max(2.5, Math.min(RACE_TAIL, rest / k)), k2 = Math.max(k, rest / tail);
  return { pace: { k: +k.toFixed(4), tw: +tw.toFixed(3), k2: +k2.toFixed(4), tail: +tail.toFixed(3) }, run: Math.ceil((tw + tail + 1.5) * 1000) };
}
const placeOf0 = (results, id) => { const r = results.find((x) => x.id === id); return r ? r.place : 0; };
const xpFor = (L) => 10 * L * L + 10 * L;
const level = (xp) => { let L = 0; while (L < MAX_LEVEL && xp >= xpFor(L + 1)) L++; return L; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// Phone input picks keys out of these tables: only their own keys count ('__proto__' etc. never do).
const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);

// A duck saved before Smarts (or any later skill/building) existed: fill in what's missing, so an
// old duck starts at Smarts level 0 and nothing breaks. Safe to call on every lookup.
function migrate(d) {
  if (!d) return d;
  if (!d.xp || typeof d.xp !== 'object') d.xp = {};
  for (const s of SKILLS) if (!Number.isFinite(d.xp[s])) d.xp[s] = 0;
  if (!d.buildings || typeof d.buildings !== 'object') d.buildings = {};
  for (const b of Object.keys(BUILDINGS)) if (!Number.isFinite(d.buildings[b])) d.buildings[b] = 0;
  if (!d.bests || typeof d.bests !== 'object') d.bests = {};
  // Best scores used to be kept per difficulty ({ easy, medium, hard }): keep the best of them.
  for (const s of Object.keys(d.bests)) { const b = d.bests[s]; if (b && typeof b === 'object') d.bests[s] = Math.max(0, ...Object.values(b).filter(Number.isFinite)); else if (!Number.isFinite(b)) d.bests[s] = 0; }
  if (!Number.isFinite(d.napUntil)) d.napUntil = 0;
  // The pantry: only the three foods; anything else (old foods) becomes the closest new one.
  const p = d.pantry && typeof d.pantry === 'object' ? d.pantry : {};
  const pantry = Object.fromEntries(Object.keys(FOOD).map((k) => [k, 0]));
  for (const [k, n] of Object.entries(p)) { const to = own(FOOD, k) ? k : own(OLD_FOOD, k) ? OLD_FOOD[k] : null; if (to && Number.isFinite(n) && n > 0) pantry[to] = Math.min(PANTRY_MAX, pantry[to] + Math.floor(n)); }
  d.pantry = pantry;
  if (d.training && d.training.diff) delete d.training.diff; // a run started with a difficulty finishes as a normal run
  if (d.riskOffer === undefined) d.riskOffer = null;
  // Quiet help (0-3 per mini-game) and how many runs of each game this duck has played.
  for (const key of ['assist', 'runs']) { const o = d[key] && typeof d[key] === 'object' ? d[key] : {}; d[key] = {}; for (const g of Object.values(GAME_FOR)) d[key][g] = Number.isFinite(o[g]) ? o[g] : 0; }
  return d;
}

const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const onOff = opt([[true, 'On'], [false, 'Off']]);
const fields = [
  { key: 'raceEvery', label: 'Race every', options: opt([[60, '1 minute'], [120, '2 minutes'], [180, '3 minutes'], [300, '5 minutes']]) },
  { key: 'races', label: 'Races in the season', options: opt([[3, '3 races'], [5, '5 races'], [8, '8 races'], [10, '10 races']]) },
  { key: 'course', label: 'Course length', options: opt([['sprint', 'Sprint (5 short sections)'], ['classic', 'Classic (5 sections, one of each)'], ['marathon', 'Marathon (8 sections, Stamina matters)']]) },
  { key: 'terrain', label: 'Terrain', options: opt([['mixed', 'Everything (track, pond, cliff, ravine, maze)'], ['classic', 'Classic (no mazes)'], ['brainy', 'Brainy (lots of mazes: Smarts matters)'], ['track', 'Track only'], ['pond', 'Pond only'], ['mountain', 'Mountain (cliffs and ravines)']]) },
  { key: 'energy', label: 'Energy', options: opt([['normal', 'Normal (food matters; tired ducks nap)'], ['relaxed', 'Relaxed (refills twice as fast)'], ['unlimited', 'Unlimited (train nonstop)']]) },
  { key: 'startCoins', label: 'Starting coins', options: opt([[30, '30 coins'], [60, '60 coins'], [120, '120 coins']]) },
  { key: 'weather', label: 'Weather', options: onOff },
  { key: 'events', label: 'Farm events (foxes, gifts, traders)', options: onOff },
  { key: 'predictions', label: 'Predict the winner for coins', options: onOff },
  { key: 'gear', label: 'Race-day gear', options: onOff },
  { key: 'catchUp', label: 'Catch-up XP for ducks in the back', options: onOff },
  { key: 'boss', label: 'Championship boss race (the Golden Goose)', options: onOff },
];
const defaults = { raceEvery: 120, races: 5, course: 'classic', terrain: 'mixed', energy: 'normal', startCoins: 60, weather: true, events: true, predictions: true, gear: true, catchUp: true, boss: false };

class Ducks {
  constructor(room, settings) {
    this.room = room; this.s = settings;
    this.ducks = new Map(); this.race = 0; this.phase = 'lobby'; // the valley is open before the game starts
    this.endsAt = 0; this.timer = null; this.course = null; this.lastRace = null;
    this.ticker = []; this.plots = 0; this.tickSeq = 0;
  }
  log(text, kind = 'info') { this.ticker.push({ id: ++this.tickSeq, text, kind }); if (this.ticker.length > 12) this.ticker.shift(); }

  duck(p) {
    if (!this.ducks.has(p.id)) {
      const r = this.room.rng, owner = p.name.replace(/ 🤖$/, '');
      this.ducks.set(p.id, {
        plot: this.plots++, name: (owner + '’s Duck').slice(0, 18), color: COLORS[Math.floor(r() * COLORS.length)], hat: 'none', hats: ['none'],
        xp: Object.fromEntries(SKILLS.map((s) => [s, 0])), energy: 100, mood: 70, coins: this.s.startCoins, points: 0, wins: 0, best: null,
        buildings: Object.fromEntries(Object.keys(BUILDINGS).map((b) => [b, 0])), decor: [], gear: [], tactic: 'steady', predict: null,
        training: null, trainingSince: 0, napUntil: 0, petAt: -1e12, last: null, history: [], badges: [], event: null, nextEvent: 0, cheers: 0,
        stats: { trained: 0, bestScore: 0, foodEaten: 0, boosts: 0 }, quests: [], rival: null, rivalWon: null,
        gene: null, eggs: this.offerEggs(), stage: 0, trophies: [],
        perks: [], perkChoice: null, streak: 0, bestStreak: 0, bests: {}, stars: 0, spunRace: -1, giftAt: -1e12, gifts: 0,
      });
      if (this.started) { this.log(`🏡 A new farm appears: ${owner}’s farm!`, 'join'); if (this.phase === 'training') this.newQuests(this.ducks.get(p.id)); }
      this.room.fx('farm', { id: p.id });
      if (p.bot) this.hatch(p.id, this.ducks.get(p.id), Math.floor(this.room.rng() * 3), true);
    }
    return migrate(this.ducks.get(p.id));
  }
  start() {
    for (const p of this.room.list()) this.duck(p);
    for (const d of this.ducks.values()) d.coins = this.s.startCoins; // settings may have changed in the lobby
    this.started = true;
    for (const d of this.ducks.values()) this.newQuests(d);
    this.log('🌅 Welcome to Duck Valley! Train your ducks, the first race is coming.');
    this.training(); this.tick();
  }
  joined(p) { this.duck(p); }
  offerEggs() { const k = SKILLS.slice(); const out = []; while (out.length < 3) out.push(k.splice(Math.floor(this.room.rng() * k.length), 1)[0]); return out; }
  hatch(id, d, pick, quiet) {
    if (d.gene) return { ok: false, error: 'Already hatched.' };
    const gene = d.eggs[pick]; if (!gene) return { ok: false, error: 'Pick an egg.' };
    d.gene = gene; d.xp[gene] += 40;
    if (!quiet) this.log(`🐣 ${this.room.name(id)}’s egg hatched: a ${EGGS[gene].about.toLowerCase().replace('a natural ', '')} duckling!`, 'join');
    this.room.fx('hatch', { id });
    return { ok: true, gene };
  }
  offerPerks(d) {
    const left = Object.keys(PERKS).filter((k) => !d.perks.includes(k));
    const out = []; while (out.length < 3 && left.length) out.push(left.splice(Math.floor(this.room.rng() * left.length), 1)[0]);
    d.perkChoice = out.length ? out : null;
  }
  spin(id, d) {
    if (d.spunRace === this.race) return { ok: false, error: 'You already spun this round. Next spin after the race!' };
    d.spunRace = this.race;
    const tot = SPIN.reduce((a, x) => a + x.w, 0); let r = this.room.rng() * tot, i = 0;
    for (; i < SPIN.length; i++) { r -= SPIN[i].w; if (r <= 0) break; }
    const p = SPIN[Math.min(i, SPIN.length - 1)]; let label = p.label;
    if (p.kind === 'coins') d.coins += p.n;
    else if (p.kind === 'energy') d.energy = Math.min(100, d.energy + p.n);
    else if (p.kind === 'mood') d.mood = Math.min(100, d.mood + p.n);
    else if (p.kind === 'xp') { const k = SKILLS[Math.floor(this.room.rng() * SKILLS.length)]; d.xp[k] += p.n; label = `+60 ${SKILL_NAME[k]} XP`; this.checkGrowth(id, d); }
    else if (p.kind === 'gear') { const g = Object.keys(GEAR).filter((k) => !d.gear.includes(k)); if (g.length && this.s.gear) { const k = g[Math.floor(this.room.rng() * g.length)]; d.gear.push(k); label = `Free ${GEAR[k].label}`; } else { d.coins += 20; label = '20 coins'; } }
    else if (p.kind === 'hat') { const h = HATS.filter((x) => x !== 'none' && !d.hats.includes(x)); if (h.length) { const k = h[Math.floor(this.room.rng() * h.length)]; d.hats.push(k); d.hat = k; label = `A new hat: ${k}`; } else { d.coins += 20; label = '20 coins'; } }
    if (p.n >= 75) this.log(`🎰 ${this.room.name(id)} hit the JACKPOT on the Lucky Spin!`, 'win');
    this.room.fx('spin', { id });
    return { ok: true, index: SPIN.indexOf(p), prize: label, icon: p.icon };
  }
  stageOf(d) { const total = SKILLS.reduce((a, k) => a + level(d.xp[k]), 0); let i = 0; while (i + 1 < STAGES.length && total >= STAGES[i + 1].from) i++; return i; }
  checkGrowth(id, d) {
    const st = this.stageOf(d);
    if (st > d.stage) { d.stage = st; d.grew = STAGES[st].label; this.offerPerks(d); this.log(`🌱 ${d.name} grew into a ${STAGES[st].label.toLowerCase()}!`, 'level'); this.room.fx('grow', { id }); }
  }

  // Every 2 seconds: energy refills, moods drift, farm events happen.
  tick() {
    this.room.after(2000, () => {
      if (this.phase === 'over') return;
      const now = this.room.now(); this._eta = null;
      for (const [id, d] of this.ducks) {
        if (!this.room.get(id)) continue;
        migrate(d);
        const regen = (this.s.energy === 'relaxed' ? 2 : 1) * (1 + 0.5 * d.buildings.feeder) / 3;
        d.energy = Math.min(100, d.energy + regen);
        if (d.riskOffer && (d.riskOffer.until <= now || this.phase !== 'training')) d.riskOffer = null; // not taken in time: keep it
        // A Risk it! round that never reports back (the phone walked away) counts as a fall.
        if (d.training && d.training.risk && !d.training.cut && now - d.training.at > (RISK.seconds + 12) * 1000) this.riskResult(id, d, d.training, 0, now);
        this.wake(id, d, now); this.autoNap(id, d, now);
        if (this.room.rng() < 0.12) d.mood = Math.max(0, d.mood - 1);
        if (this.phase === 'training' && this.s.events) this.maybeEvent(id, d, now);
        if (d.event && d.event.until <= now) this.resolveEvent(id, d, null);
      }
      this.tick();
    });
  }

  // ---- naps: automatic, never a button ----
  // The cheapest training there is: below this a duck is too tired to train.
  napBelow() { return this.s.energy === 'unlimited' ? 0 : TRAIN_COST; }
  // A duck whose energy runs out (too low for another run) falls asleep on its own, during the
  // training period and only between mini-games (never while a Risk it! offer is open). It wakes up
  // after the nap with its energy back. While it sleeps it can't train; it can still be fed and petted
  // (the food waits in its bowl).
  autoNap(id, d, now = this.room.now()) {
    if (this.phase !== 'training' || this.s.energy === 'unlimited' || d.training || d.riskOffer || d.napUntil > now || !d.gene || d.energy >= this.napBelow()) return false;
    const secs = NAP_SECONDS - 3 * (d.buildings.coop || 0);
    d.napUntil = now + secs * 1000; d.napGain = 35 + 15 * (d.buildings.coop || 0); d.napped = (d.napped || 0) + 1;
    this.room.fx('nap', { id });
    const until = d.napUntil;
    this.room.after(secs * 1000, () => { if (d.napUntil === until) this.wake(id, d, this.room.now()); });
    return true;
  }
  wake(id, d, now) {
    if (!d.napUntil || now < d.napUntil) return false;
    d.energy = Math.min(100, d.energy + (d.napGain || 35)); d.mood = Math.min(100, d.mood + 5); d.napUntil = 0; d.napGain = 0;
    this.room.fx('wake', { id });
    return true;
  }

  // ---- season ----
  // The season's races, planned when the first one is set up (from the room's seed). Every race but
  // the final is in its own world (never the same world twice) and features the skills that fit it
  // (THEMES[k].skills), as many as that world tends to (THEMES[k].counts, 1 to 6): a Fly-only dash on
  // the Sky Islands, Climb and Fly at the volcano, a bit of everything in Candy Land. A single-skill
  // race is the catch-up race: a duck trained in that one skill can win it.
  // Fair over the season (soft balancing): every race gives its featured skills an equal share of
  // its course; the planner keeps each skill's share and leans later picks (worlds and skills) toward
  // the skills featured least so far (SEASON.lean per race-share ahead); on 4+ races every skill is
  // featured at least once before the final; a plan where one skill gets far more than its share
  // (SEASON.maxShare × the average) or one gets far less (SEASON.minShare) is planned again (up to
  // SEASON.tries times; the fairest one wins). Brainy: Smarts in every race. Classic: no Smarts.
  // The Grand Championship uses every skill.  -> [{ theme, skills }, …, { theme, skills: null }]
  // (A race's share of the course per skill, as planSeason() counts it: raceShares().)
  planSeason() {
    const R = Math.max(1, this.s.races), rng = this.room.rng, brainy = this.s.terrain === 'brainy';
    const allowed = SKILLS.filter((k) => this.s.terrain !== 'classic' || k !== 'smarts');
    const pick = (items, w) => { const tot = items.reduce((a, x) => a + w(x), 0); let r = rng() * tot; for (const x of items) { r -= w(x); if (r <= 0) return x; } return items[items.length - 1]; };
    const sumOf = (o) => allowed.reduce((a, k) => a + o[k], 0);
    const attempt = () => {
      const plan = [], share = Object.fromEntries(allowed.map((k) => [k, 0])), seen = [];
      for (let i = 0; i < R - 1; i++) {
        const left = R - 1 - i; // races before the final, this one included
        const lo = Math.min(...allowed.map((k) => share[k]));
        const need = (k) => Math.pow(SEASON.lean, share[k] - lo);
        const missing = allowed.filter((k) => share[k] === 0);
        // the world: one not seen this season, likelier the more it features the skills that are behind
        const fit = (w) => { const S = THEMES[w].skills, tot = sumOf(S); return Math.pow(allowed.reduce((a, k) => a + (S[k] / tot) * need(k), 0), 2); };
        const theme = pick(Object.keys(THEMES).filter((k) => !seen.includes(k)), fit); seen.push(theme);
        const T = THEMES[theme];
        // how many skills: the world's own odds; on 4+ races, enough to fit in the skills never featured
        const must = R >= 4 ? Math.max(0, missing.length - (left - 1) * SEASON.perRace) : 0;
        const n = clamp(Math.max(1 + pick([0, 1, 2, 3, 4, 5], (c) => T.counts[c] || 0), must), 1, allowed.length);
        const chosen = brainy ? ['smarts'] : [];
        while (chosen.filter((k) => missing.includes(k)).length < must) chosen.push(pick(missing.filter((k) => !chosen.includes(k)), (k) => T.skills[k]));
        while (chosen.length < n) chosen.push(pick(allowed.filter((k) => !chosen.includes(k)), (k) => T.skills[k] * need(k)));
        const sh = raceShares(theme, chosen, this.s.terrain); for (const k of allowed) share[k] += sh[k] || 0;
        plan.push({ theme, skills: SKILLS.filter((k) => chosen.includes(k)) });
      }
      const unfeatured = R >= 4 ? allowed.filter((k) => share[k] === 0).length : 0;
      // the final: every skill, in a world that likes all-rounder courses
      const left = Object.keys(THEMES).filter((k) => !seen.includes(k));
      plan.push({ theme: pick(left, (k) => 0.5 + (THEMES[k].counts[4] || 0) + (THEMES[k].counts[5] || 0)), skills: null });
      for (const k of allowed) share[k] += 1 / allowed.length;
      const mean = sumOf(share) / allowed.length, hi = Math.max(...allowed.filter((k) => !brainy || k !== 'smarts').map((k) => share[k])), lo = Math.min(...allowed.map((k) => share[k]));
      const bad = unfeatured * 10 + Math.max(0, hi - Math.max(SEASON.maxShare * mean, 1 + 1 / allowed.length + 1e-9)) + (R >= 4 ? Math.max(0, SEASON.minShare * mean - lo) : 0);
      return { plan, bad };
    };
    let best = null;
    for (let i = 0; i < SEASON.tries; i++) { const a = attempt(); if (!best || a.bad < best.bad) best = a; if (!a.bad) break; }
    return best.plan;
  }
  newCourse(n) {
    // A race's sections come from its featured skills only, so the race looks like its world: each
    // featured skill gets an even share of the sections (a Fly-only race is all ravines, a Climb and
    // Fly race is cliffs and ravines). A featured Stamina makes it a long race where the ducks tire
    // early; a Stamina-only race is a long trek (TREK) on flat trail where only Stamina counts. The
    // final: one of each kind of section. Sprint courses have shorter sections; from the fourth race
    // on there is one more section. Track only / Pond only / Mountain: no plan, sections by the
    // landscape's weights.
    const ALL = ['track', 'pond', 'cliff', 'gap', 'maze'];
    const pool = { mixed: ALL, classic: ['track', 'pond', 'cliff', 'gap'], brainy: ALL, track: ['track'], pond: ['pond'], mountain: ['cliff', 'gap', 'track'] }[this.s.terrain] || ALL;
    const rng = this.room.rng, themeKeys = Object.keys(THEMES), late = Math.min(1, Math.floor((n - 1) / 3));
    const varied = pool.length >= 4;
    if (varied && (!this.plan || this.plan.length !== this.s.races || !this.plan[0] || !this.plan[0].theme)) this.plan = this.planSeason();
    const P = varied ? this.plan[Math.min(this.plan.length, Math.max(1, n)) - 1] : null;
    const feat = P ? P.skills : null;
    const featSec = feat ? feat.map((k) => SEC_OF[k]).filter((x) => x && pool.includes(x)) : [];
    const trek = !!(feat && !featSec.length);
    const endurance = !!(feat && feat.includes('stamina'));
    const brainy = this.s.terrain === 'brainy';
    // The world: the planned one; else (no plan) not the last one, and not one already seen this
    // season while unseen ones are left.
    this.seenThemes = n <= 1 || !this.seenThemes ? [] : this.seenThemes;
    let theme;
    if (P) theme = P.theme;
    else { const fresh = themeKeys.filter((k) => !this.seenThemes.includes(k) && k !== (this.course && this.course.theme)); const cand = fresh.length ? fresh : themeKeys.filter((k) => k !== (this.course && this.course.theme)); theme = cand[Math.floor(rng() * cand.length)]; }
    this.seenThemes.push(theme);
    const T = THEMES[theme];
    const weight = (x) => (T.weights[x] || 1) * (brainy && x === 'maze' ? 4 : 1);
    const pickW = (opts) => { const tot = opts.reduce((a, x) => a + weight(x), 0); let r = rng() * tot; for (const x of opts) { r -= weight(x); if (r <= 0) return x; } return opts[0]; };
    const base = { sprint: 5, classic: 5, marathon: 8 }[this.s.course] || 5;
    const bag = [];
    let count;
    if (!varied) {
      count = ({ sprint: 4, classic: 5, marathon: 8 }[this.s.course] || 5) + late;
      while (bag.length < count) bag.push(pickW(pool));
    } else if (!feat) { // the final: one of each (+ extras on long courses)
      count = Math.max(pool.length, base) + late + (brainy ? 1 : 0);
      bag.push(...pool);
      while (bag.length < count) bag.push(pickW(pool));
    } else if (trek) { // Stamina only: a long trek
      count = base + late + 1;
      while (bag.length < count) bag.push('track');
    } else {
      count = Math.max(base + late, featSec.length) + (endurance ? 1 : 0);
      const each = Math.floor(count / featSec.length);
      for (const x of featSec) for (let i = 0; i < each; i++) bag.push(x);
      const extra = featSec.slice(); while (bag.length < count) bag.push(extra.splice(Math.floor(rng() * extra.length), 1)[0]);
      if (brainy && !bag.includes('maze')) bag.push('maze');
    }
    // The order: a track start (the ducks run off the line) when there is one, then the rest
    // shuffled, never the same kind twice in a row when that can be helped.
    const types = [];
    if (bag.includes('track')) { types.push('track'); bag.splice(bag.indexOf('track'), 1); }
    while (bag.length) {
      const prev = types[types.length - 1], ok = bag.map((x, i) => i).filter((i) => bag[i] !== prev);
      const from = ok.length ? ok : bag.map((x, i) => i), i = from[Math.floor(rng() * from.length)];
      types.push(bag.splice(i, 1)[0]);
    }
    // A trek keeps to flat trail (no hurdles) where the world has one.
    const flat = T.variants.track.filter((v) => !JUMPS[v] && v !== 'ice');
    // Combined sections: when the race features both skills, a section mostly takes its combined
    // variant (COMBO_ODDS); a variant whose second skill isn't featured is an ordinary section.
    const on = feat || (varied ? SKILLS : []); // the final features everything
    const comboOf = (type, v) => { const m = COMBO[type + ':' + v]; return m && on.includes(m) && !(feat && feat.length === 1) ? m : null; };
    const sections = types.map((type) => {
      const vs = trek && type === 'track' && flat.length ? flat : T.variants[type], combos = vs.filter((v) => comboOf(type, v));
      const v = combos.length && rng() < COMBO_ODDS ? combos[Math.floor(rng() * combos.length)] : vs[Math.floor(rng() * vs.length)];
      const mix = trek ? null : comboOf(type, v);
      return mix ? { type, v, mix } : { type, v };
    });
    const featured = feat ? feat.slice() : [...new Set(['stamina', ...types.map((x) => SECTIONS[x].skill)])].filter((k) => SKILLS.includes(k));
    const scale = this.s.course === 'sprint' ? 0.8 : 1;
    const secLen = Object.fromEntries(Object.entries(SECTIONS).map(([k, x]) => [k, Math.round(x.len * scale)]));
    const final = n === this.s.races;
    const league = this.leagueFor(n);
    // The weather: the world's own odds (the first race is always clear); now and then it turns
    // mid-race (change: at x metres it becomes `to`). wind: +1 tailwind, -1 headwind (windy or stormy).
    const odds = WEATHER_ODDS[theme] || { sunny: 1 }, length = sections.reduce((a, x) => a + secLen[x.type], 0);
    let weather = 'sunny', change = null;
    if (this.s.weather && n > 1) { const ks = Object.keys(odds), tot = ks.reduce((a, k) => a + odds[k], 0); let r = this.room.rng() * tot; weather = ks[ks.length - 1]; for (const k of ks) { r -= odds[k]; if (r <= 0) { weather = k; break; } } }
    if (this.s.weather && this.room.rng() < WEATHER_TURN) {
      const worst = Object.keys(odds).filter((k) => k !== 'sunny' && k !== 'windy' && k !== 'heat').sort((a, b) => odds[b] - odds[a])[0] || 'rain';
      const to = weather === 'sunny' || weather === 'windy' || weather === 'heat' ? worst : 'sunny';
      if (to !== weather) change = { x: Math.round(length * (0.35 + 0.3 * this.room.rng())), to, say: TURN_SAY[to] || `${WEATHER[to].icon} The weather turns!` };
    }
    const wind = WEATHER[weather].wind || (change && WEATHER[change.to].wind) ? (this.room.rng() < 0.5 ? 1 : -1) : 0;
    const forecast = `${WEATHER[weather].icon} ${weather === 'windy' || weather === 'storm' ? (wind > 0 ? WEATHER[weather].label + ' (tailwind): flyers fly further!' : WEATHER[weather].label + ' (headwind): strong flyers push through, weak ones get blown back.') : WEATHER[weather].tip}${change ? ' 🌦️ The weather may turn during the race!' : ''}`;
    // What the TV and phones show before the race: a single-skill race gets its own banner
    // ("🪽 Sky Dash: Fly only!"), a race with 5-6 skills is an all-rounder course.
    const solo = featured.length === 1 ? featured[0] : null;
    const banner = solo ? `${SOLO[solo][0]} ${SOLO[solo][1]}: ${SKILL_NAME[solo]} only!` : featured.length >= 5 ? '🌈 All-rounder course!' : null;
    return { n, final, league, leagueName: LEAGUES[league].label, leagueIcon: LEAGUES[league].icon, theme, themeName: T.label, name: final ? 'Grand Championship' : `${LEAGUES[league].label}: ${NAMES[(n - 1) % NAMES.length]}`, featured, solo, banner, trek, endurance, sections, weather, wind, change, forecast, boss: !!(final && this.s.boss), secLen, length, variants: VARIANT };
  }
  leagueFor(n) { return n >= this.s.races ? LEAGUES.length - 1 : Math.min(LEAGUES.length - 2, Math.floor(((n - 1) * (LEAGUES.length - 1)) / Math.max(1, this.s.races - 1))); }
  // The season road: every race's league, so players can see where the season is going.
  ladder() { return Array.from({ length: this.s.races }, (_, i) => { const L = LEAGUES[this.leagueFor(i + 1)]; return { n: i + 1, icon: L.icon, label: L.label, final: i + 1 === this.s.races, done: i + 1 <= this.race }; }); }
  training() {
    this.phase = 'training';
    this.course = this.newCourse(this.race + 1);
    this.endsAt = this.room.now() + this.s.raceEvery * 1000;
    this.room.cancel(this.timer); this.timer = this.room.after(this.s.raceEvery * 1000, () => this.runRace());
    // Race-day hype: 15 seconds out, the TV shows the favorites and every phone asks for a tactic.
    this.room.cancel(this.hypeTimer);
    this.hypeTimer = this.room.after(Math.max(0, this.s.raceEvery * 1000 - HYPE_MS), () => {
      if (this.phase !== 'training') return;
      this.room.fx('hype'); this.log(`📣 Race day! ${this.course.name} starts in 15 seconds…`, 'hype');
    });
    for (const d of this.ducks.values()) { d.predict = null; this.newQuests(d); }
    const w = WEATHER[this.course.weather];
    this.log(`📣 Next up: ${this.course.name} at ${this.course.themeName}${this.course.banner ? ' · ' + this.course.banner : ''}. Forecast: ${w.icon} ${w.label}.`);
    for (const p of this.room.list()) if (p.bot) this.botLoop(p);
  }

  simulate() {
    const C = this.course, entries = [];
    const LEN = courseLen(C), bounds = []; let acc = 0; for (const x of C.sections) { bounds.push([acc, acc + LEN[x.type], x.type, x.v, x]); acc += LEN[x.type]; }
    // Jumps: hurdles (every 11 m) or fallen logs (every 15 m, harder) on track sections.
    // Jumps: hurdles, fallen logs, lava streams, cactus, chimneys, roots, gumdrops, hay bales (JUMPS).
    const hurdles = []; if (!C.trek) for (const [a, b, s, v] of bounds) if (s === 'track' && JUMPS[v]) { const [k, gap, hard] = JUMPS[v]; for (let x = a + 9; x < b - 4; x += gap) hurdles.push({ x, k, log: k === 'log', hard }); }
    // Maze forks: the same spots for every duck; each duck's choice at each one is an event.
    const forks = []; for (const [a, b, s] of bounds) if (s === 'maze') for (const x of forksIn(a, b)) forks.push({ x });
    const boosts = []; for (const [a, b, s, v, o] of bounds) if (s !== 'cliff' && s !== 'maze') { boosts.push({ x: a + (b - a) * 0.55, s, o }); if (MORE_BOOSTS.has(v)) boosts.push({ x: a + (b - a) * 0.25, s, o }); }
    // The weather at x metres (it may turn mid-race at C.change.x).
    const wAt = (x) => (C.change && x >= C.change.x ? C.change.to : C.weather);
    const racers = [...this.ducks].filter(([id]) => this.room.get(id));
    for (const [, d] of racers) migrate(d);
    // Wild ducks fill the field when only a few people are playing, stronger in higher leagues.
    // Their level follows the field: about as good as the average player duck, tougher in higher leagues.
    const fieldLv = racers.length ? racers.reduce((a, [, d]) => a + SKILLS.reduce((x, k) => x + level(d.xp[k]), 0) / SKILLS.length, 0) / racers.length : 1;
    for (let i = 0; racers.length < 6; i++) {
      const L = Math.max(0, Math.round(fieldLv * (0.55 + 0.11 * (C.league || 0))) + Math.floor(this.room.rng() * 3) - 1);
      racers.push(['w' + i, { wild: true, name: WILD[(this.race * 3 + i) % WILD.length], color: ['cocoa', 'snow', 'mallard', 'sunny', 'midnight', 'ember'][i % 6], hat: ['none', 'cap', 'bow', 'headband', 'none', 'viking'][i % 6], xp: Object.fromEntries(SKILLS.map((k) => [k, xpFor(L)])), mood: 60, energy: 100, tactic: ['steady', 'sprint', 'finish'][i % 3], gear: [], stage: L > 6 ? 2 : 1 }]);
    }
    // The boss race: the Golden Goose joins the Grand Championship (BOSS).
    if (C.boss) {
      const people = racers.filter(([, d]) => !d.wild), top = people.length ? Math.max(...people.map(([, d]) => SKILLS.reduce((a, k) => a + level(d.xp[k]), 0) / SKILLS.length)) : 1;
      const BL = clamp(Math.round(top * BOSS.mult + BOSS.edge), 0, MAX_LEVEL);
      racers.push(['boss', { wild: true, boss: true, name: BOSS.name, color: BOSS.color, hat: BOSS.hat, xp: Object.fromEntries(SKILLS.map((k) => [k, xpFor(BL)])), mood: 60, energy: 100, tactic: 'steady', gear: [], perks: [], stage: BOSS.stage }]);
    }
    this.wild = Object.fromEntries(racers.filter(([, d]) => d.wild).map(([id, d]) => [id, { name: d.name, color: d.color, hat: d.hat, stage: d.stage, wild: true, boss: !!d.boss }]));
    const L = C.length, DT = 0.1, SAMPLE = 0.5;
    const fatFrom = L * fatStart(C), fatRamp = L * FATIGUE.ramp;
    for (const [id, d] of racers) {
      const lv = this.levels(d), gear = new Set(d.gear), rng = this.room.rng;
      const perk = new Set(d.perks || []);
      let x = 0, t = 0, lastV = 1, stopped = 0, tired = false, nextH = 0, nextB = 0, nextF = 0, boostUntil = 0, slowUntil = 0, shortUntil = 0, holdX = null, lastSi = -1;
      const oddsIn = {}, oddsAt = (w) => oddsIn[w] || (oddsIn[w] = forkOdds(lv.smarts, gear.has('map'), perk.has('compass'), false, wfx(w, 'wrong')));
      // Stamina: how much this duck slows down by the finish line (the late race).
      const depth = Math.min(0.75, fatigueDepth(lv.stamina, { bar: gear.has('energybar'), lungs: perk.has('lungs'), tactic: d.tactic, low: d.energy < 20 }) * wfx(wAt(L), 'tire'));
      // One mishap spot per cliff (a slip), pond (a gulp), ravine (a dip) and icy track (a skid).
      // A combined section has one too (a maze: its second skill's mishap; dunes: a slide back down).
      const slipAt = {}; bounds.forEach(([a, b, s, v, o], i) => { if (s === 'cliff' || s === 'pond' || s === 'gap' || (s === 'maze' && o.mix)) slipAt[i] = a + (b - a) * (0.3 + rng() * 0.5); if (s === 'track' && (v === 'ice' || o.mix) && !C.trek) slipAt[i] = a + (b - a) * (0.2 + rng() * 0.6); });
      const luck = 0.97 + rng() * 0.06 + (WEATHER[C.weather].luck ? (rng() - 0.5) * 0.1 : 0);
      // "Weak": this skill is 0-1 or WEAK_GAP below the duck's own average (the commentary says so).
      const avgLv = SKILLS.reduce((a, k) => a + lv[k], 0) / SKILLS.length, weak = (k) => (lv[k] <= 1 && avgLv >= 2) || lv[k] <= avgLv - WEAK_GAP;
      const samples = [0], events = [];
      while (x < L && t < 400) {
        t += DT;
        if (stopped > 0) { stopped -= DT; } else {
          const si = bounds.findIndex(([a, b]) => x >= a && x < b), [, , sec, vr, so] = bounds[Math.max(0, si)], S = SECTIONS[sec], wx = wAt(x);
          if (si !== lastSi) { lastSi = si; if (si >= 0 && !C.trek && secSkills(so).some(weak)) events.push({ t: +t.toFixed(1), id, k: 'weak', h: si }); }
          let v = S.v0 * (C.trek ? SKILL_SPEED(TREK.lv) : secSpeed(so, lv)); // a trek: everyone walks at one pace
          v *= wfx(wx, S.skill); // the weather: slower running in the rain, faster ponds…
          if (sec === 'cliff' && onWall(bounds[si], x)) v *= WALL.speed; // hand over hand up the rock wall
          // Section variants: the same for every duck (the skill already sets the speed).
          if (vr === 'mud') v *= gear.has('sneakers') ? 0.95 : 0.86;
          if (vr === 'sand' || vr === 'dunes') v *= 0.9;
          if (vr === 'ice') v *= 0.95;
          if (vr === 'rapids') v *= 1.1;
          if (vr === 'icy') v *= 0.92;
          if (vr === 'waves') v *= 0.9 + rng() * 0.2;
          if (vr === 'ash') v *= 0.94;
          if (vr === 'puddles') v *= gear.has('sneakers') ? 0.97 : 0.92;
          if (vr === 'taffy') v *= gear.has('sneakers') ? 0.95 : 0.88;
          if (vr === 'cloudpath' || vr === 'skylake') v *= 1.05;
          if (vr === 'hotspring') v *= 0.95;
          if (vr === 'choco') v *= 0.9;
          if (vr === 'icecave') v *= 0.95;
          if (t < shortUntil) v *= SHORT_SPEED; // took a maze shortcut
          const prog = x / L;
          if (d.tactic === 'sprint') v *= prog < 0.4 ? 1.08 : 1;
          if (d.tactic === 'finish') v *= prog < 0.5 ? 0.95 : prog > 0.7 ? 1.1 : 1;
          if (sec === 'pond' && gear.has('flippers')) v *= 1.1;
          if (sec === 'gap' && gear.has('glider')) v *= 1.1;
          if (sec === 'cliff' && gear.has('claws')) v *= 1.1;
                    if (sec === 'gap' && C.wind && WEATHER[wx].wind) v *= C.wind > 0 ? 1.04 + 0.06 * (1 - 1 / SKILL_SPEED(lv.fly)) : 1 - 0.12 / SKILL_SPEED(lv.fly); // a tailwind carries strong flyers further, a headwind pushes weak ones back
          if (d.mood < 30) v *= 0.97; else if (d.mood >= 70) v *= 1.02;
          if (d.energy < 20) v *= 0.96;
          // The late race: every duck tires; Stamina sets how much.
          const fat = x > fatFrom ? depth * Math.min(1, (x - fatFrom) / fatRamp) : 0;
          v *= 1 - fat;
          if (!tired && fat >= FATIGUE.tired) { tired = true; events.push({ t: +t.toFixed(1), id, k: 'tired' }); }
          if (t < boostUntil) v *= 1.35;
          if (t < slowUntil) v *= 0.55; // stumbled after clipping a hurdle
          if (perk.size) { const pg = x / L; if (perk.has('burst') && pg < 0.2) v *= 1.15; if (perk.has('closer') && pg > 0.8) v *= 1.1; if (perk.has('webbed') && sec === 'pond') v *= 1.08; if (perk.has('feather') && sec === 'gap') v *= 1.08; }
          v *= luck;
          lastV = v;
          const nx = x + v * DT;
          // Boost pads / currents / updrafts: a better-trained duck catches them more often.
          while (nextB < boosts.length && boosts[nextB].x <= nx) {
            const B = boosts[nextB++];
            if (B.x > x && rng() < (0.2 + 0.3 * (1 - 1 / (C.trek ? SKILL_SPEED(TREK.lv) : secSpeed(B.o, lv)))) * (perk.has('lucky') ? 1.6 : 1)) { boostUntil = t + 1.2; events.push({ t: +t.toFixed(1), id, k: 'boost' }); }
          }
          // Hurdles: every jump is clean, clipped (the bar goes down, a stumble) or a crash into the
          // fence (a dazed stop). Run level, rain, sneakers and Nimble Feet set the odds.
          while (nextH < hurdles.length && hurdles[nextH].x <= nx) {
            if (hurdles[nextH].x > x) {
              const H = hurdles[nextH], wet = wfx(wAt(H.x), 'trip'), nim = perk.has('nimble') ? 0.5 : 1;
              const pTrip = gear.has('sneakers') ? 0 : Math.max(0.02, mishap(MISHAP.trip, lv.run)) * wet * H.hard * nim;
              const pClip = Math.max(0.03, mishap(MISHAP.clip, lv.run)) * wet * Math.max(1, H.hard * 0.92) * nim * (gear.has('sneakers') ? 0.5 : 1);
              const r = rng();
              if (r < pTrip) { stopped = TRIP_STOP; holdX = H.x; events.push({ t: +t.toFixed(2), id, k: 'trip', h: nextH }); }
              else if (r < pTrip + pClip) { slowUntil = t + CLIP_SLOW; events.push({ t: +t.toFixed(2), id, k: 'clip', h: nextH }); }
            }
            nextH++;
          }
          // Maze forks: the shortcut (Smarts), a think (a pause at the fork) or a wrong turn (the duck
          // walks off the wrong way and comes back: it stays at the fork for WRONG_STOP seconds).
          while (stopped <= 0 && nextF < forks.length && forks[nextF].x <= nx) {
            if (forks[nextF].x > x) {
              const r = rng(), odds = oddsAt(wAt(forks[nextF].x));
              if (r < odds.wrong) { stopped = WRONG_STOP; holdX = forks[nextF].x; events.push({ t: +t.toFixed(2), id, k: 'wrong', h: nextF }); }
              else if (r < odds.wrong + odds.short) { shortUntil = t + SHORT_BOOST; events.push({ t: +t.toFixed(2), id, k: 'short', h: nextF }); }
              else { stopped = THINK_STOP; holdX = forks[nextF].x; events.push({ t: +t.toFixed(2), id, k: 'think', h: nextF }); }
            }
            nextF++;
          }
          x = stopped > 0 && holdX != null ? Math.min(nx, holdX) : nx;
          // The section's own mishap: a slip down the cliff (Climb), a gulp of water (Swim), a dip into
          // the ravine (Fly), a skid on ice (Run). Rarer the better the skill (mishap()).
          if (si >= 0 && slipAt[si] != null && x >= slipAt[si]) {
            const ice = bounds[si][3] === 'ice', wl = secLevel(so, lv); // a combined section: the weaker skill's odds
            let p = 0, k = null;
            if (sec === 'cliff') { k = 'slip'; p = perk.has('grip') ? 0 : mishap(MISHAP.slip, wl) * (gear.has('claws') ? 0.5 : 1) * (ice ? 1.6 : 1) * wfx(wx, 'slip'); }
            else if (sec === 'pond') { k = 'gulp'; p = mishap(MISHAP.gulp, wl) * (gear.has('flippers') ? 0.6 : 1); }
            else if (sec === 'gap') { k = 'dip'; p = mishap(MISHAP.dip, wl) * (gear.has('glider') ? 0.6 : 1) * (C.wind < 0 && WEATHER[wx].wind ? 1.3 : 1); }
            else if (sec === 'track') { k = 'skid'; p = mishap(MISHAP.skid, wl) * (perk.has('nimble') ? 0.5 : 1); }
            else if (sec === 'maze' && so.mix) { k = so.mix === 'fly' ? 'dip' : 'gulp'; p = mishap(MISHAP[k], lv[so.mix]); }
            if (k && rng() < p) {
              if (k === 'slip') x = Math.max(bounds[si][0], x - 3.5);
              else { stopped = k === 'skid' ? 0.8 : k === 'gulp' ? GULP_STOP : DIP_STOP; holdX = x; }
              events.push({ t: +t.toFixed(1), id, k });
            }
            delete slipAt[si];
          }
        }
        if (Math.abs(t / SAMPLE - Math.round(t / SAMPLE)) < 1e-6) samples.push(Math.round(Math.min(x, L) * 10));
      }
      const time = t - (x > L ? Math.min(DT, (x - L) / Math.max(0.1, lastV)) : 0); // the moment it crossed the line
      samples.push(Math.round(L * 10));
      entries.push({ id, time, samples, events, lv: SKILLS.map((k) => lv[k]) });
    }
    return { entries, hurdles: hurdles.map((h) => ({ x: h.x, k: h.k, log: h.log })), forks: forks.map((f) => f.x), boosts: boosts.map((b) => b.x) };
  }
  runRace() {
    if (this.phase !== 'training') return;
    this.race++; this.phase = 'race'; this.room.cancel(this.timer); this.room.cancel(this.hypeTimer);
    // Training stops the moment the race starts: a mini-game in progress is cut off (the phone closes
    // it and sends the score it had; that score counts, capped by the time played before the start;
    // after RACE_GRACE nothing more is accepted). Napping ducks wake up with their energy.
    const now = this.room.now();
    for (const [id, d] of this.ducks) {
      migrate(d);
      if (d.napUntil) { d.napUntil = Math.min(d.napUntil, now); this.wake(id, d, now); }
      d.event = null; if (!d.gene) this.hatch(id, d, 0);
      d.riskOffer = null; // an open Risk it! offer: the player keeps their XP
      if (d.training && !d.training.cut) {
        d.training.cut = now; const tr = d.training;
        this.room.after(RACE_GRACE, () => { if (d.training === tr) d.training = null; });
      }
    }
    const favorites = this.favorites(), before = new Map(this.standings().map((x, i) => [x.id, i + 1]));
    const { entries, hurdles, forks, boosts } = this.simulate();
    entries.sort((a, b) => a.time - b.time);
    const mult = this.course.final ? 2 : 1;
    const winnerId = entries[0] && entries[0].id;
    const wildWin = winnerId && this.wild[winnerId];
    const results = entries.map((e, i) => {
      const d = this.ducks.get(e.id), place = i + 1;
      if (!d) return { id: e.id, place, time: Math.round(e.time * 100) / 100, pts: 0, coins: 0, wild: true };
      const pts = (POINTS[i] != null ? POINTS[i] : 1) * mult, coins = PRIZE[i] != null ? PRIZE[i] : 8;
      const wasLast = d.history.length && d.history[d.history.length - 1] === d.last.of;
      d.points += pts; d.coins += coins; if (place === 1) { d.wins++; d.mood = Math.min(100, d.mood + 20); }
      d.best = d.best ? Math.min(d.best, place) : place;
      d.energy = Math.max(0, d.energy - 8 * this.course.sections.length / 4);
      this.checkGrowth(e.id, d);
      d.last = { place, of: entries.length, pts, coins, time: e.time, trips: e.events.filter((x) => x.k === 'trip').length, slips: e.events.filter((x) => x.k === 'slip').length, shortcuts: e.events.filter((x) => x.k === 'short').length, wrongs: e.events.filter((x) => x.k === 'wrong').length, gulps: e.events.filter((x) => x.k === 'gulp').length, dips: e.events.filter((x) => x.k === 'dip').length, tired: e.events.some((x) => x.k === 'tired'), weak: this.weakest(d, this.course) };
      d.history.push(place); d.gear = [];
      if (place <= 3) d.trophies.push({ race: this.race, league: this.course.league, place, icon: LEAGUES[this.course.league].icon });
      d.stats.boosts += e.events.filter((x) => x.k === 'boost').length;
      if (place === 1) this.badge(e.id, d, 'firstWin');
      if (place <= 3) this.badge(e.id, d, 'podium');
      if (place <= 3 && wasLast) this.badge(e.id, d, 'comeback');
      if (place === 1 && this.course.final) this.badge(e.id, d, 'champion');
      return { id: e.id, place, time: Math.round(e.time * 100) / 100, pts, coins };
    });
    // The boss race: did anyone beat the Golden Goose?
    let boss = null;
    if (this.course.boss && placeOf0(results, 'boss')) {
      const bp = placeOf0(results, 'boss'), by = results.filter((r) => !r.wild && r.place < bp).map((r) => r.id);
      boss = { name: BOSS.name, place: bp, beaten: by.length > 0, by };
      if (boss.beaten) {
        for (const [id, d] of this.ducks) if (this.room.get(id)) { d.coins += BOSS.bonus; d.bossBonus = BOSS.bonus; }
        for (const id of by) { const d = this.ducks.get(id); d.trophies.push({ race: this.race, league: this.course.league, place: 0, icon: '👑', boss: true }); this.badge(id, d, 'goose'); }
        this.log(`👑 ${this.ducks.get(by[0]).name} beat the Golden Goose! Everyone gets ${BOSS.bonus} coins!`, 'win');
      } else this.log('🪿 The Golden Goose keeps its crown… HONK!', 'event');
    }
    // Rivals: beat last race's rival for a bonus; then the duck just ahead becomes the new rival.
    const placeOf = Object.fromEntries(results.map((r) => [r.id, r.place]));
    const people = results.filter((r) => !r.wild);
    for (const r of people) {
      const d = this.ducks.get(r.id);
      d.rivalWon = null;
      if (d.rival && placeOf[d.rival] != null) {
        if (r.place < placeOf[d.rival]) { d.coins += 15; d.rivalWon = true; if (r.place <= 10) this.log(`⚔️ ${d.name} beat their rival ${this.ducks.get(d.rival).name}!`, 'event'); } else d.rivalWon = false;
      }
      const k = people.indexOf(r);
      d.rival = k > 0 ? people[k - 1].id : people[1] ? people[1].id : null;
    }
    // Predictions pay out.
    for (const [id, d] of this.ducks) if (d.predict) {
      const r = results.find((x) => x.id === d.predict);
      if (r && r.place === 1) { d.coins += 30; d.predictWon = 30; this.badge(id, d, 'oracle'); } else if (r && r.place <= 3) { d.coins += 10; d.predictWon = 10; } else d.predictWon = 0;
    }
    // Season standings before and after, and the race's talking points for the TV.
    const after = this.standings(), moves = {};
    after.forEach((x, i) => { moves[x.id] = [before.get(x.id) || after.length, i + 1]; });
    const margin = entries[1] ? Math.round((entries[1].time - entries[0].time) * 100) / 100 : null;
    const nameOf = (id) => { const d = this.ducks.get(id) || this.wild[id]; return d ? d.name : '?'; };
    const highlights = [];
    if (margin != null && margin < 0.35) highlights.push({ icon: '📸', text: `Photo finish! ${nameOf(entries[0].id)} won by ${margin.toFixed(2)}s` });
    if (boss) highlights.push(boss.beaten ? { icon: '👑', text: `${nameOf(boss.by[0])} beat the Golden Goose! +${BOSS.bonus} coins for everyone` } : { icon: '🪿', text: `The Golden Goose won${boss.place === 1 ? ' the Grand Championship' : ''}. Nobody beat it this time!` });
    if (wildWin && winnerId !== 'boss') highlights.push({ icon: '🌿', text: `A wild duck, ${nameOf(winnerId)}, stole the win!` });
    else if (favorites.length >= 3 && winnerId && winnerId !== 'boss' && !favorites.includes(winnerId)) highlights.push({ icon: '😲', text: `Upset! ${nameOf(winnerId)} wasn’t one of the favorites` });
    const climb = this.race > 1 ? after.map((x) => ({ x, up: moves[x.id][0] - moves[x.id][1] })).sort((a, b) => b.up - a.up)[0] : null;
    if (climb && climb.up >= 2) highlights.push({ icon: '📈', text: `${climb.x.duck} climbs from #${moves[climb.x.id][0]} to #${moves[climb.x.id][1]} in the season` });
    const rivalsBeaten = people.filter((r) => this.ducks.get(r.id).rivalWon).length;
    if (rivalsBeaten) highlights.push({ icon: '⚔️', text: `${rivalsBeaten} rival${rivalsBeaten === 1 ? '' : 's'} beaten` });
    const tripper = entries.map((e) => ({ id: e.id, n: e.events.filter((x) => x.k === 'trip' || x.k === 'slip' || x.k === 'skid').length })).sort((a, b) => b.n - a.n)[0];
    if (tripper && tripper.n >= 3) highlights.push({ icon: '💫', text: `${nameOf(tripper.id)} took ${tripper.n} tumbles and still finished` });
    this.lastRace = {
      n: this.race, name: this.course.name, final: this.course.final, sections: this.course.sections, theme: this.course.theme, themeName: this.course.themeName, league: this.course.league, wild: this.wild, weather: this.course.weather, wind: this.course.wind, change: this.course.change, forecast: this.course.forecast, featured: this.course.featured, solo: this.course.solo, banner: this.course.banner, boss, length: this.course.length, hurdles, forks, boosts,
      intro: RACE_INTRO, sample: 0.5, results, margin, favorites, moves, highlights: highlights.slice(0, 4), secLen: courseLen(this.course), tripStop: TRIP_STOP, wrongStop: WRONG_STOP, thinkStop: THINK_STOP,
      // each duck: its path (x every 0.5 s), its moments ([t, kind] or [t, kind, hurdle or fork]) and its levels (run, swim, fly, climb, stamina, smarts)
      tracks: entries.map((e) => ({ id: e.id, s: e.samples, ev: e.events.map((x) => (x.h != null ? [x.t, x.k, x.h] : [x.t, x.k])), lv: e.lv })),
      ...racePace(entries),
    };
    const w = winnerId && (this.ducks.get(winnerId) || this.wild[winnerId]);
    const runMs = this.lastRace.run;
    this.room.fx('raceStart');
    this.endsAt = this.room.now() + RACE_INTRO + runMs + RACE_OUTRO;
    this.timer = this.room.after(RACE_INTRO + runMs + RACE_OUTRO, () => {
      this.phase = 'results'; this.endsAt = this.room.now() + RESULT_SHOW; this.room.fx('raceDone');
      if (w) this.log(`🏆 ${w.name}${winnerId === 'boss' ? ' (the boss!)' : wildWin ? ' (a wild duck!)' : ''} wins the ${this.course.name}!`, 'win');
      this.timer = this.room.after(RESULT_SHOW, () => this.afterRace());
    });
  }
  afterRace() {
    if (this.race >= this.s.races) {
      this.phase = 'over'; this.endsAt = 0; this.room.fx('win');
      // End-of-season awards.
      const list = [...this.ducks].filter(([id]) => this.room.get(id));
      const pick = (f) => list.slice().sort((a, b) => f(b[1]) - f(a[1]))[0];
      const pretty = pick((d) => d.decor.length * 10 + Object.values(d.buildings).reduce((a, b) => a + b, 0) * 5);
      const trainer = pick((d) => d.stats.trained);
      const strong = pick((d) => SKILLS.reduce((a, s) => a + level(d.xp[s]), 0));
      const fan = pick((d) => d.cheers);
      this.awards = [pretty && ['🌷 Prettiest Farm', pretty[0]], trainer && ['🏋️ Hardest Trainer', trainer[0]], strong && ['💪 Strongest Duck', strong[0]], fan && fan[1].cheers > 0 && ['📣 Loudest Fan', fan[0]]].filter(Boolean).map(([t, id]) => ({ title: t, id, owner: this.room.name(id), duck: this.ducks.get(id).name, avatar: this.avatar(id) }));
      return;
    }
    this.training();
  }
  next() {
    if (this.phase === 'training') this.runRace();
    else if (this.phase === 'race' || this.phase === 'results') { this.room.cancel(this.timer); this.afterRace(); }
  }

  // The party scoreboard: player ids best-first, once the season is over.
  results() { return this.phase === 'over' ? this.standings().map((x) => x.id) : []; }

  // ---- helpers ----
  levels(d) { const o = {}; for (const s of SKILLS) o[s] = level(d.xp[s]); return o; }
  totalLevel(d) { return SKILLS.reduce((a, k) => a + level(d.xp[k]), 0); }
  avatar(id) { const p = this.room.get(id); return p && typeof p.avatar === 'string' && p.avatar ? p.avatar.slice(0, 8) : null; }
  standings() {
    return [...this.ducks].filter(([id]) => this.room.get(id)).map(([id, d]) => ({ id, owner: this.room.name(id), avatar: this.avatar(id), duck: d.name, points: d.points, wins: d.wins, best: d.best }))
      .sort((a, b) => b.points - a.points || b.wins - a.wins || (a.best || 99) - (b.best || 99));
  }
  // The phone's live race: the same playback numbers the TV uses, and only this duck's own path,
  // so the phone follows its duck jump by jump while everyone watches the big screen.
  liveFor(id) {
    const R = this.lastRace, tr = R && R.tracks.find((x) => x.id === id);
    if (!tr) return null;
    const res = R.results.find((x) => x.id === id);
    return { intro: R.intro, run: R.run, outro: RACE_OUTRO, pace: R.pace, sample: R.sample, length: R.length, secLen: R.secLen, sections: R.sections, hurdles: R.hurdles, forks: R.forks, tripStop: R.tripStop, wrongStop: R.wrongStop, thinkStop: R.thinkStop, s: tr.s, ev: tr.ev, time: res.time, place: res.place, of: R.results.length };
  }
  // A rough race-time estimate for the next course (no luck or boosts; mishaps at their average
  // cost): what the phone's "projected place" and the TV's favorites use. Lower is faster.
  eta(d) {
    const C = this.course; if (!C) return 0;
    const lv = this.levels(d), LEN = courseLen(C), perks = d.perks || []; let t = 0;
    const odds = forkOdds(lv.smarts, false, perks.includes('compass'), false, wfx(C.weather, 'wrong'));
    for (const x of C.sections) {
      const S = SECTIONS[x.type], len = LEN[x.type], wl = secLevel(x, lv), v = S.v0 * (C.trek ? SKILL_SPEED(TREK.lv) : secSpeed(x, lv)) * wfx(C.weather, S.skill); t += (len / v) * (x.type === 'cliff' ? 1 + WALL.share * (1 / WALL.speed - 1) : 1);
      if (x.type === 'maze') t += forksIn(0, len).length * (odds.wrong * WRONG_STOP + (1 - odds.wrong - odds.short) * THINK_STOP - odds.short * SHORT_BOOST * (1 - 1 / SHORT_SPEED));
      if (x.type === 'track' && JUMPS[x.v] && !C.trek) t += Math.max(0, Math.floor((len - 13) / JUMPS[x.v][1]) + 1) * mishap(MISHAP.trip, lv.run) * JUMPS[x.v][2] * TRIP_STOP * wfx(C.weather, 'trip');
      if (x.type === 'pond') t += mishap(MISHAP.gulp, wl) * GULP_STOP;
      if (x.type === 'gap') t += mishap(MISHAP.dip, wl) * DIP_STOP;
      if (x.type === 'maze' && x.mix) t += mishap(MISHAP[x.mix === 'fly' ? 'dip' : 'gulp'], lv[x.mix]) * GULP_STOP;
      if (x.type === 'cliff' && !perks.includes('grip')) t += (mishap(MISHAP.slip, wl) * 3.5 * wfx(C.weather, 'slip')) / v;
    }
    // The late race: from the fatigue start the duck slows down by up to `depth` (ramping in).
    const depth = Math.min(0.75, fatigueDepth(lv.stamina, { lungs: perks.includes('lungs'), tactic: d.tactic, low: d.energy < 20 }) * wfx(C.weather, 'tire'));
    const late = 1 - fatStart(C), avg = (depth * (late - FATIGUE.ramp / 2)) / late;
    t = t * (1 - late) + (t * late) / (1 - avg);
    return t / (d.mood >= 70 ? 1.02 : d.mood < 30 ? 0.97 : 1) / (d.energy < 20 ? 0.96 : 1);
  }
  // The skill holding this duck back on a course (its lowest among the skills the course uses;
  // Stamina always counts): { skill, level, gap } when it is clearly behind (at 0 while the others
  // are not, or WEAK_GAP - 1 levels under the duck's own average), else null. The phone shows it.
  weakest(d, C) {
    const lv = this.levels(d), used = new Set(['stamina', ...(C ? (C.trek ? [] : C.sections.flatMap(secSkills)) : SKILLS)]);
    const ks = SKILLS.filter((k) => used.has(k)), avg = ks.reduce((a, k) => a + lv[k], 0) / ks.length;
    const k = ks.slice().sort((a, b) => lv[a] - lv[b])[0];
    return k && ((lv[k] === 0 && avg >= 1) || lv[k] <= avg - (WEAK_GAP - 1)) ? { skill: k, level: lv[k], gap: Math.round(avg - lv[k]) } : null;
  }
  // Every present duck ranked by eta (cached until something changes).
  etaRanks() {
    const key = this.race + ':' + this.phase;
    if (this._eta && this._eta.key === key) return this._eta.rank;
    const rank = new Map([...this.ducks].filter(([id, d]) => this.room.get(id) && d.gene).map(([id, d]) => [id, this.eta(d)]).sort((a, b) => a[1] - b[1]).map(([id], i) => [id, i + 1]));
    this._eta = { key, rank }; return rank;
  }
  favorites() { return [...this.etaRanks()].filter(([, r]) => r <= 3).sort((a, b) => a[1] - b[1]).map(([id]) => id); }
  badge(id, d, key) {
    if (d.badges.includes(key)) return;
    d.badges.push(key); d.coins += BADGES[key][2]; d.newBadge = key;
    this.log(`${BADGES[key][0]} ${d.name} earned “${BADGES[key][1]}”!`, 'badge');
    this.room.fx('badge', { id });
  }
  checkBadges(id, d) {
    const lv = this.levels(d), vals = Object.values(lv);
    if (vals.some((v) => v >= 5)) this.badge(id, d, 'level5');
    if (vals.some((v) => v >= 10)) this.badge(id, d, 'level10');
    if (vals.every((v) => v >= 3)) this.badge(id, d, 'allround');
    if (Object.values(d.buildings).filter((v) => v > 0).length >= 3) this.badge(id, d, 'builder');
    if (d.hats.length - 1 >= 3) this.badge(id, d, 'stylish');
    if (d.coins >= 300) this.badge(id, d, 'rich');
    if (d.mood >= 100) this.badge(id, d, 'happy');
  }
  moodMult(d) { return d.mood >= 70 ? 1.15 : d.mood < 30 ? 0.8 : 1; }

  // ---- quests ----
  newQuests(d) {
    const keys = Object.keys(QUESTS).filter((k) => k !== 'gear' || this.s.gear);
    const picked = [];
    while (picked.length < 3 && keys.length) picked.push(keys.splice(Math.floor(this.room.rng() * keys.length), 1)[0]);
    const needs = this.course ? [...new Set(this.course.sections.map((x) => SECTIONS[x.type].skill))] : SKILLS;
    d.quests = picked.map((kind) => {
      const Q = QUESTS[kind], q = { kind, n: Q.n[Math.floor(this.room.rng() * Q.n.length)], have: 0, done: false, reward: Q.reward };
      if (kind === 'train') { q.skill = needs[Math.floor(this.room.rng() * needs.length)]; q.skillName = SKILL_NAME[q.skill]; }
      q.text = Q.text(q);
      return q;
    });
  }
  quest(id, d, kind, value = 1, skill = null) {
    for (const q of d.quests) {
      if (q.done || q.kind !== kind || (q.skill && q.skill !== skill)) continue;
      q.have = kind === 'score' || kind === 'mood' ? Math.max(q.have, value) : q.have + value;
      if (q.have >= q.n) {
        q.done = true; d.coins += q.reward; d.questDone = q.text;
        this.log(`📜 ${this.room.name(id)} finished a quest: ${q.text}.`, 'quest');
      }
    }
  }

  // ---- farm events ----
  maybeEvent(id, d, now) {
    if (d.event || d.training || now < d.nextEvent) return;
    if (!d.nextEvent) { d.nextEvent = now + 30000 + this.room.rng() * 40000; return; }
    d.nextEvent = now + 45000 + this.room.rng() * 45000;
    const r = this.room.rng(), owner = this.room.name(id);
    let ev;
    if (r < 0.3) { ev = { kind: 'fox', text: 'A fox is sneaking around your farm! Scare it off before it steals your coins!', choices: [['scare', '📣 Shoo!']], seconds: 10 }; this.log(`🦊 A fox is prowling around ${owner}’s farm…`, 'event'); }
    else if (r < 0.5) ev = { kind: 'gift', text: 'A neighbor left a basket of fresh bread at your gate.', choices: [['take', '🍞 Thank you!']], seconds: 20 };
    else if (r < 0.65) { const hat = HATS.filter((h) => h !== 'none' && !d.hats.includes(h))[0]; if (!hat) return; ev = { kind: 'trader', text: `A traveling trader offers a rare ${hat} hat for just 8 coins.`, hat, choices: [['buy', '🪙 Buy (8)'], ['no', 'No thanks']], seconds: 20 }; }
    else if (r < 0.8) ev = { kind: 'storm', text: 'A rain cloud is right over your pond! Splash around for free Swim XP?', choices: [['splash', '💦 Splash! (+40 Swim XP)'], ['no', 'Stay dry']], seconds: 15 };
    else ev = { kind: 'duckling', text: 'A lost duckling wandered onto your farm. Help it find its mom?', choices: [['help', '🐣 Help (+mood, +coins)'], ['no', 'Not now']], seconds: 20 };
    ev.until = now + ev.seconds * 1000; ev.id = now;
    d.event = ev;
    this.room.fx('event', { id, kind: ev.kind });
  }
  resolveEvent(id, d, choice) {
    const ev = d.event; if (!ev) return { ok: false, error: 'Nothing is happening right now.' };
    d.event = null;
    const owner = this.room.name(id); let msg = '';
    if (ev.kind === 'fox') {
      if (choice === 'scare') { d.mood = Math.min(100, d.mood + 10); msg = 'The fox ran away! Your duck feels safe. (+10 mood)'; this.log(`📣 ${owner} chased the fox away!`, 'event'); }
      else { const lost = Math.min(d.coins, 15); d.coins -= lost; d.mood = Math.max(0, d.mood - 10); msg = `The fox got away with ${lost} coins…`; this.log(`🦊 The fox stole ${lost} coins from ${owner}!`, 'event'); }
    } else if (ev.kind === 'gift') { if (choice === 'take') { d.energy = Math.min(100, d.energy + 25); msg = '+25 energy. Yum!'; } }
    else if (ev.kind === 'trader') { if (choice === 'buy') { if (d.coins < 8) return { ok: false, error: 'Not enough coins.' }; d.coins -= 8; d.hats.push(ev.hat); d.hat = ev.hat; msg = `New hat: ${ev.hat}!`; this.checkBadges(id, d); } }
    else if (ev.kind === 'storm') { if (choice === 'splash') { d.xp.swim += 40; msg = '+40 Swim XP. Splish splash!'; } }
    else if (ev.kind === 'duckling') { if (choice === 'help') { d.mood = Math.min(100, d.mood + 20); d.coins += 10; msg = 'Reunited! The ducks paid you 10 coins. (+20 mood)'; this.log(`🐣 ${owner} helped a lost duckling home.`, 'event'); } }
    d.eventMsg = msg;
    return { ok: true, msg };
  }

  // ---- actions ----
  act(p, m) {
    const d = this.duck(p), now = this.room.now(), id = p.id;
    this._eta = null; m = m && typeof m === 'object' ? m : {};
    if (m.op === 'style') {
      if (m.name != null) { const n = String(m.name).replace(/[\u0000-\u001f<>&"]/g, '').trim().slice(0, 18); if (n) d.name = n; }
      if (m.color && COLORS.includes(m.color)) d.color = m.color;
      if (m.hat && d.hats.includes(m.hat)) d.hat = m.hat;
      return { ok: true };
    }
    if (m.op === 'cheer') {
      if (this.phase !== 'race') return { ok: false };
      if (d.cheerAt != null && now - d.cheerAt < CHEER_GAP) return { ok: true }; // a mashing phone: quietly drop the extra taps
      d.cheerAt = now; d.cheers++; this.room.fx('cheer', { id }); return { ok: true };
    }
    if (this.phase === 'over') return { ok: false, error: 'The season is over.' };
    if (m.op === 'hatch') return this.hatch(id, d, Number(m.pick));
    if (m.op === 'perk') {
      if (!d.perkChoice || !own(PERKS, m.key) || !d.perkChoice.includes(m.key)) return { ok: false, error: 'Pick one of the offered perks.' };
      d.perks.push(m.key); d.perkChoice = null;
      this.log(`${PERKS[m.key].icon} ${d.name} learned ${PERKS[m.key].label}!`, 'level');
      return { ok: true };
    }
    if (!d.gene && m.op !== 'event') return { ok: false, error: 'Hatch your egg first! 🥚' };
    if (this.phase === 'lobby') return { ok: false, error: 'Waiting for the host to start the game…' };
    if (m.op === 'event') return this.resolveEvent(id, d, String(m.choice || ''));
    this.wake(id, d, now);
    // A mini-game cut off by the race start: its score (up to the start) is accepted for a few seconds.
    const finishing = (m.op === 'score' || m.op === 'cancel') && d.training && d.training.cut && now - d.training.cut <= RACE_GRACE && this.phase !== 'over';
    if (this.phase !== 'training' && !finishing) return { ok: false, error: '🏁 Race in progress: training opens after the race.', race: true };
    switch (m.op) {
      case 'train': {
        if (!SKILLS.includes(m.stat)) return { ok: false, error: 'Pick a skill to train.' };
        if (d.napUntil > now) return { ok: false, error: `😴 ${d.name} is napping. Training opens when it wakes up.`, nap: true };
        if (d.training && now - d.training.at < (RUN_SECONDS + 15) * 1000) return { ok: false, error: 'Finish your training first.' };
        if (d.training && d.training.risk) this.riskResult(id, d, d.training, 0, now); // an abandoned Risk it! round counts as a fall
        // (an old phone may still send a difficulty: it is ignored, every run plays at the normal pace)
        const cost = this.s.energy === 'unlimited' ? 0 : TRAIN_COST;
        if (d.energy < cost) return { ok: false, error: 'Too tired! Feed your duck, or it naps by itself.' };
        d.riskOffer = null; // starting a new run keeps the last one's XP
        d.energy -= cost; d.training = { stat: m.stat, at: now };
        // Quiet help: a player who keeps scoring low in this game gets a gentler pace and wider
        // windows (assist), never announced; it fades as they do better. Risk it! rounds never get it.
        const game = GAME_FOR[m.stat], assist = d.assist[game] || 0;
        return { ok: true, game, seconds: RUN_SECONDS, speed: +(1 - ASSIST.slow * assist).toFixed(2), assist, first: !d.runs[game], target: TARGET, best: d.bests[m.stat] || 0 };
      }
      case 'score': {
        const tr = d.training; if (!tr) return { ok: false, error: 'No training in progress.' };
        d.training = null;
        if (tr.risk) { const out = this.riskResult(id, d, tr, m.score, now); this.autoNap(id, d, now); out.nap = d.napUntil > now ? d.napUntil - now : 0; return out; }
        const secs = Math.min(RUN_SECONDS + 2, ((tr.cut || now) - tr.at) / 1000);
        const score = Math.max(0, Math.min(SCORE_MAX, Math.floor(Number(m.score) || 0), Math.floor(secs * SCORE_RATE) + 1));
        const out = { ok: true, ...this.reward(id, d, tr.stat, score, !!tr.cut), cut: !!tr.cut };
        // Risk it!: offered after every full run that earned XP, unless the race is about to start.
        if (!tr.cut && out.xp > 0 && !p.bot && this.phase === 'training') {
          const game = GAME_FOR[tr.stat];
          if (this.endsAt - now > (RISK.seconds + 12) * 1000) {
            const goal = riskGoal(game, score);
            d.riskOffer = { stat: tr.stat, game, xp: out.xp, goal, until: now + RISK.offerMs };
            out.risk = { goal, seconds: RISK.seconds, win: out.xp, lose: out.xp - Math.floor(out.xp / 2), stat: tr.stat };
          } else out.riskNo = 'The race is about to start: no time to risk it.';
        }
        this.autoNap(id, d, now); // too tired for another run: it falls asleep right away (after the Risk it! choice)
        out.nap = d.napUntil > now ? d.napUntil - now : 0;
        return out;
      }
      case 'cancel': {
        const tr = d.training; d.training = null;
        // A Risk it! round stopped by the race (or during its countdown) keeps the XP; walking away from
        // one that is already being played counts as a fall.
        if (tr && tr.risk && !tr.cut && now - tr.at > 4000) { const out = this.riskResult(id, d, tr, 0, now); this.autoNap(id, d, now); return out; }
        this.autoNap(id, d, now); return { ok: true };
      }
      case 'risk': {
        const o = d.riskOffer; d.riskOffer = null;
        if (!o || o.until <= now) return { ok: false, error: 'Nothing to risk right now.' };
        if (d.training) return { ok: false, error: 'Finish your training first.' };
        if (this.endsAt - now < (RISK.seconds + 6) * 1000) { this.autoNap(id, d, now); return { ok: false, error: 'The race is about to start: you keep your XP.' }; }
        d.training = { stat: o.stat, at: now, risk: { xp: o.xp, goal: o.goal } };
        this.room.fx('risk', { id });
        return { ok: true, game: o.game, seconds: RISK.seconds, speed: RISK.speed, goal: o.goal, risk: true, win: o.xp, lose: o.xp - Math.floor(o.xp / 2), stat: o.stat };
      }
      case 'keep': {
        d.riskOffer = null; this.autoNap(id, d, now);
        return { ok: true, nap: d.napUntil > now ? d.napUntil - now : 0 };
      }
      case 'pet': {
        if (now - d.petAt < PET_COOLDOWN) return { ok: false, error: 'Your duck needs a moment. 🦆' };
        d.petAt = now; d.mood = Math.min(100, d.mood + 6); this.checkBadges(id, d); this.quest(id, d, 'pet'); this.quest(id, d, 'mood', d.mood);
        this.room.fx('pet', { id });
        return { ok: true };
      }
      case 'feed': {
        const f = own(FOOD, m.item) && FOOD[m.item]; if (!f) return { ok: false, error: 'Not on the menu.' };
        const item = m.item, have = d.pantry[item] > 0;
        if (d.energy >= 100) { // full: what you buy now waits in the pantry
          if (have || d.pantry[item] >= PANTRY_MAX) return { ok: false, error: 'Your duck is full already.' };
          if (d.coins < f.cost) return { ok: false, error: 'Not enough coins.' };
          d.coins -= f.cost; d.pantry[item]++;
          return { ok: true, stored: true, item, have: d.pantry[item] };
        }
        if (have) d.pantry[item]--;
        else { if (d.coins < f.cost) return { ok: false, error: 'Not enough coins.' }; d.coins -= f.cost; }
        d.energy = Math.min(100, d.energy + f.energy); d.stats.foodEaten++;
        this.room.fx('eat', { id, item }); this.quest(id, d, 'feed');
        return { ok: true, item, fromPantry: have, have: d.pantry[item], energy: Math.round(d.energy) };
      }
      case 'build': {
        const b = own(BUILDINGS, m.item) && BUILDINGS[m.item]; if (!b) return { ok: false, error: 'Unknown building.' };
        const lvl = d.buildings[m.item]; if (lvl >= 3) return { ok: false, error: 'Already fully upgraded.' };
        const cost = BUILD_COST[lvl]; if (d.coins < cost) return { ok: false, error: `Needs ${cost} coins.` };
        d.coins -= cost; d.buildings[m.item]++; this.quest(id, d, 'build');
        this.log(`🔨 ${this.room.name(id)} ${lvl ? 'upgraded' : 'built'} a ${b.label}${lvl ? ' (level ' + (lvl + 1) + ')' : ''}.`, 'build');
        this.room.fx('build', { id }); this.checkBadges(id, d);
        return { ok: true };
      }
      case 'decor': {
        const it = own(DECOR, m.item) && DECOR[m.item]; if (!it) return { ok: false, error: 'Unknown decoration.' };
        if (d.decor.includes(m.item)) return { ok: false, error: 'You have that already.' };
        if (d.coins < it[2]) return { ok: false, error: 'Not enough coins.' };
        d.coins -= it[2]; d.decor.push(m.item); d.mood = Math.min(100, d.mood + 5); this.quest(id, d, 'build');
        this.room.fx('build', { id });
        return { ok: true };
      }
      case 'hat': {
        if (!HATS.includes(m.hat) || m.hat === 'none') return { ok: false, error: 'Pick a hat.' };
        if (d.hats.includes(m.hat)) { d.hat = m.hat; return { ok: true }; }
        if (d.coins < 15) return { ok: false, error: 'Hats cost 15 coins.' };
        d.coins -= 15; d.hats.push(m.hat); d.hat = m.hat; this.checkBadges(id, d); return { ok: true };
      }
      case 'gear': {
        if (!this.s.gear) return { ok: false, error: 'Gear is off in this game.' };
        const g = own(GEAR, m.item) && GEAR[m.item]; if (!g) return { ok: false, error: 'Unknown gear.' };
        if (d.gear.includes(m.item)) return { ok: false, error: 'Already packed for the race.' };
        if (d.coins < g.cost) return { ok: false, error: 'Not enough coins.' };
        d.coins -= g.cost; d.gear.push(m.item); this.quest(id, d, 'gear'); return { ok: true };
      }
      case 'spin': return this.spin(id, d);
      case 'gift': {
        const to = this.ducks.get(m.to);
        if (!to || m.to === id || !this.room.get(m.to)) return { ok: false, error: 'Pick a friend’s farm.' };
        if (now - d.giftAt < 30000) return { ok: false, error: 'You can send another gift in a few seconds.' };
        if (d.coins < 5) return { ok: false, error: 'A gift costs 5 coins.' };
        d.coins -= 5; d.giftAt = now; d.gifts++; d.mood = Math.min(100, d.mood + 5);
        to.energy = Math.min(100, to.energy + 15); to.mood = Math.min(100, to.mood + 8); to.giftFrom = this.room.name(id);
        this.log(`🎁 ${this.room.name(id)} sent seeds to ${this.room.name(m.to)}’s farm.`, 'event');
        this.room.fx('gift', { id: m.to }); this.quest(id, d, 'gift');
        return { ok: true };
      }
      case 'tactic': if (!own(TACTICS, m.tactic)) return { ok: false, error: 'Unknown tactic.' }; d.tactic = m.tactic; return { ok: true };
      case 'predict': {
        if (!this.s.predictions) return { ok: false, error: 'Predictions are off.' };
        if (!this.ducks.has(m.id) || !this.room.get(m.id)) return { ok: false, error: 'Pick a duck.' };
        d.predict = m.id; return { ok: true };
      }
      default: return { ok: false, error: 'Unknown action.' };
    }
  }
  // cut: the race start stopped this run early (its score counts; a missed star never breaks a streak).
  reward(id, d, stat, score, cut = false) {
    let xp = baseXp(stat, score, !cut);
    const star = score >= TARGET;
    // Streak: hit the ⭐ target again and again for up to +30% XP; a miss resets it.
    if (star) { d.streak++; d.stars++; d.bestStreak = Math.max(d.bestStreak, d.streak); } else if (!cut) d.streak = 0;
    xp *= 1 + 0.05 * Math.min(6, d.streak);
    const newBest = score > (d.bests[stat] || 0); if (newBest) d.bests[stat] = score;
    const game = GAME_FOR[stat]; d.runs[game] = (d.runs[game] || 0) + 1;
    if (!cut) { const pay = score * 4 * (PAY[game] || 1); d.assist[game] = clamp((d.assist[game] || 0) + (pay < ASSIST.low ? 1 : pay >= ASSIST.high ? -1 : 0), 0, ASSIST.max); }
    const b = BUILDINGS[Object.keys(BUILDINGS).find((k) => BUILDINGS[k].skill === stat)];
    const bl = b ? d.buildings[Object.keys(BUILDINGS).find((k) => BUILDINGS[k] === b)] : 0;
    xp *= 1 + 0.2 * bl;
    xp *= this.moodMult(d);
    if (d.gene === stat) xp *= 1.25; // natural talent from the egg
    if (this.s.catchUp && this.race > 0) { const st = this.standings(), i = st.findIndex((x) => x.id === id); if (i >= st.length / 2) xp *= 1.5; }
    xp = Math.round(xp);
    const before = level(d.xp[stat]);
    d.xp[stat] += xp; const coins = Math.ceil(score / 2) + (star ? 5 : 0); d.coins += coins;
    d.mood = Math.max(0, d.mood - 2); d.stats.trained++; d.stats.bestScore = Math.max(d.stats.bestScore, score);
    const after = level(d.xp[stat]);
    this.checkGrowth(id, d);
    if (after > before) { this.room.fx('levelUp', { id }); if (after % 5 === 0) this.log(`⬆️ ${d.name} reached ${stat} level ${after}!`, 'level'); }
    this.checkBadges(id, d); this.quest(id, d, 'train', 1, stat); this.quest(id, d, 'score', score); if (star) this.quest(id, d, 'star');
    const progress = after >= MAX_LEVEL ? null : { level: after, have: d.xp[stat] - xpFor(after), need: xpFor(after + 1) - xpFor(after), gained: Math.min(xp, d.xp[stat] - xpFor(after)) };
    return { score, xp, coins, stat, levelUp: after > before ? after : null, mood: d.mood, star, streak: d.streak, newBest, target: TARGET, progress };
  }
  // The end of a Risk it! round (tr.risk = { xp, goal }): the server decides, from the score it is
  // sent (capped by the time played) and how long the round ran.
  //  win:  the goal is met and the round was played to the end (or cut by the race after the goal
  //        was already met): the XP of the risked run is added again (double).
  //  fall: the goal is missed (or the round was abandoned): the duck falls over and loses half of
  //        that run's XP (it keeps the other half).
  //  kept: the race start cut the round before the goal was met: nothing changes.
  riskResult(id, d, tr, raw, now) {
    const R = tr.risk, stat = tr.stat;
    const secs = Math.min(RISK.seconds + 4, ((tr.cut || now) - tr.at) / 1000);
    const score = Math.max(0, Math.min(SCORE_MAX, Math.floor(Number(raw) || 0), Math.floor(secs * SCORE_RATE) + 1));
    const played = secs >= RISK.seconds - 0.5; // a phone can't finish the round before its time is up
    const outcome = score >= R.goal && (played || tr.cut) ? 'win' : tr.cut ? 'kept' : 'fall';
    if (d.training === tr) d.training = null;
    const before = level(d.xp[stat]);
    let change = 0;
    if (outcome === 'win') {
      change = R.xp; d.xp[stat] += change; d.stats.riskWins = (d.stats.riskWins || 0) + 1;
      this.room.fx('riskWin', { id }); this.log(`🎲 ${d.name} risked it all on ${SKILL_NAME[stat]}… and DOUBLED the XP!`, 'level');
    } else if (outcome === 'fall') {
      change = -Math.min(d.xp[stat], R.xp - Math.floor(R.xp / 2)); d.xp[stat] += change;
      this.room.fx('tumble', { id });
    }
    const after = level(d.xp[stat]);
    this.checkGrowth(id, d); this.checkBadges(id, d);
    if (after > before) this.room.fx('levelUp', { id });
    const progress = after >= MAX_LEVEL ? null : { level: after, have: d.xp[stat] - xpFor(after), need: xpFor(after + 1) - xpFor(after), gained: Math.max(0, Math.min(change, d.xp[stat] - xpFor(after))) };
    return { ok: true, risk: outcome, score, goal: R.goal, stat, xp: change, base: R.xp, levelUp: after > before ? after : null, levelDown: after < before ? after : null, cut: !!tr.cut, progress };
  }

  // ---- bots: train, eat, build, pick tactics ----
  botLoop(p) {
    this.room.after(5000 + this.room.rng() * 12000, () => {
      if (this.phase !== 'training' || !this.room.get(p.id)) return;
      const d = this.duck(p), r = this.room.rng();
      if (d.event) this.resolveEvent(p.id, d, d.event.choices[0][0]);
      if (d.perkChoice) this.act(p, { op: 'perk', key: d.perkChoice[0] });
      if (d.spunRace !== this.race && r < 0.3) this.spin(p.id, d);
      if (!d.predict && this.s.predictions) { const ids = [...this.ducks.keys()].filter((x) => this.room.get(x)); this.act(p, { op: 'predict', id: ids[Math.floor(r * ids.length)] }); }
      if (r < 0.15) this.act(p, { op: 'tactic', tactic: Object.keys(TACTICS)[Math.floor(this.room.rng() * 3)] });
      const cheapest = Object.keys(BUILDINGS).filter((k) => d.buildings[k] < 3).sort((a, b) => d.buildings[a] - d.buildings[b])[0];
      const napping = d.napUntil > this.room.now();
      // Bots never nap on purpose (nobody can): a tired bot eats if it can, else it falls asleep by itself.
      if (d.energy < TRAIN_COST && this.s.energy !== 'unlimited' && !napping && d.coins >= FOOD.seeds.cost + 10 && r < 0.6) {
        this.act(p, { op: 'feed', item: d.coins >= FOOD.corn.cost + 10 ? 'corn' : 'seeds' });
      } else if (cheapest && d.coins >= BUILD_COST[d.buildings[cheapest]] + 30 && r < 0.4) this.act(p, { op: 'build', item: cheapest });
      else if (!napping) {
        const need = this.course.sections.map((x) => SECTIONS[x.type].skill).concat(['stamina']);
        const stat = this.room.rng() < 0.7 ? need.sort((a, b) => d.xp[a] - d.xp[b])[0] : SKILLS[Math.floor(this.room.rng() * SKILLS.length)];
        if (this.act(p, { op: 'train', stat }).ok) { d.training.at -= RUN_SECONDS * 1000; this.act(p, { op: 'score', score: 8 + Math.floor(this.room.rng() * 18) }); }
      }
      if (d.mood < 50 && this.room.rng() < 0.5) this.act(p, { op: 'pet' });
      this.botLoop(p);
    });
  }

  // ---- views ----
  farmView(id, d) {
    const now = this.room.now();
    return {
      id, plot: d.plot, owner: this.room.name(id), avatar: this.avatar(id), total: this.totalLevel(d), name: d.name, color: d.color, hat: d.hat, levels: this.levels(d), energy: Math.round(d.energy), mood: Math.round(d.mood),
      points: d.points, wins: d.wins, buildings: d.buildings, decor: d.decor, badges: d.badges.length,
      perks: d.perks, streak: d.streak,
      stage: d.gene ? d.stage : -1, stageName: d.gene ? STAGES[d.stage].label : 'Egg', gene: d.gene, trophies: d.trophies.map((t) => t.place), eggColor: d.gene ? null : EGGS[d.eggs[0]].color,
      busy: d.training ? GAME_FOR[d.training.stat] : d.napUntil > now ? 'nap' : null, event: d.event ? d.event.kind : null,
    };
  }
  tv() {
    const st = this.standings(), rank = new Map(st.map((x, i) => [x.id, i + 1]));
    const endsIn = this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0;
    const hype = this.phase === 'training' && endsIn <= HYPE_MS;
    return {
      phase: this.phase, race: this.race, races: this.s.races, endsIn, hype, ladder: this.started ? this.ladder() : null,
      favorites: hype ? this.favorites() : null,
      course: this.course, weather: WEATHER, tactics: TACTICS, leagues: LEAGUES,
      lastRace: this.lastRace && (this.phase === 'race' || this.phase === 'results' || this.phase === 'over') ? this.lastRace : null,
      farms: [...this.ducks].filter(([id]) => this.room.get(id)).map(([id, d]) => ({ ...this.farmView(id, d), rank: this.race ? rank.get(id) : null })),
      standings: st.slice(0, 10), ticker: this.ticker, awards: this.phase === 'over' ? this.awards || [] : null,
    };
  }
  view(p) {
    const d = this.duck(p), st = this.standings(), now = this.room.now();
    const nextFor = (s) => { const L = level(d.xp[s]); return L >= MAX_LEVEL ? null : { have: d.xp[s] - xpFor(L), need: xpFor(L + 1) - xpFor(L) }; };
    const out0 = { endsIn: this.endsAt ? Math.max(0, this.endsAt - now) : 0 };
    const out = {
      phase: this.phase, race: this.race, races: this.s.races, endsIn: this.endsAt ? Math.max(0, this.endsAt - now) : 0,
      course: this.course, weather: WEATHER, sections: SECTIONS,
      duck: { ...this.farmView(p.id, d), coins: d.coins, hats: d.hats, gear: d.gear, tactic: d.tactic, predict: d.predict, last: d.last, badges: d.badges, progress: Object.fromEntries(SKILLS.map((s) => [s, nextFor(s)])), petIn: Math.max(0, d.petAt + PET_COOLDOWN - now) },
      napLeft: d.napUntil > now ? d.napUntil - now : 0, napTotal: (NAP_SECONDS - 3 * (d.buildings.coop || 0)) * 1000, napGain: d.napGain || 35 + 15 * (d.buildings.coop || 0), training: d.training ? { stat: d.training.stat, game: GAME_FOR[d.training.stat], cut: !!d.training.cut } : null,
      // Training is closed from the race start until the podium is over (and the server refuses it too).
      trainLock: this.phase === 'race' || this.phase === 'results' ? 'race' : null,
      event: d.event ? { kind: d.event.kind, text: d.event.text, choices: d.event.choices, endsIn: Math.max(0, d.event.until - now) } : null, eventMsg: d.eventMsg || null,
      newBadge: d.newBadge || null, questDone: d.questDone || null, grew: d.grew || null,
      eggs: d.gene ? null : d.eggs.map((k) => ({ skill: k, ...EGGS[k] })), gene: d.gene ? { skill: d.gene, ...EGGS[d.gene] } : null, stages: STAGES, trophies: d.trophies, leagues: LEAGUES, variants: VARIANT, themes: Object.fromEntries(Object.entries(THEMES).map(([k, t]) => [k, t.label])),
      quests: d.quests.map((q) => ({ text: q.text, have: Math.min(q.have, q.n), n: q.n, done: q.done, reward: q.reward })),
      rival: d.rival && this.ducks.has(d.rival) ? { name: this.ducks.get(d.rival).name, owner: this.room.name(d.rival) } : null, rivalWon: this.phase === 'results' ? d.rivalWon : null,
      target: TARGET, risk: { seconds: RISK.seconds }, riskOffer: d.riskOffer && d.riskOffer.until > now ? { goal: d.riskOffer.goal, stat: d.riskOffer.stat, win: d.riskOffer.xp, lose: d.riskOffer.xp - Math.floor(d.riskOffer.xp / 2), endsIn: d.riskOffer.until - now } : null,
      perks: d.perks.map((k) => ({ key: k, ...PERKS[k] })), perkChoice: d.perkChoice ? d.perkChoice.map((k) => ({ key: k, ...PERKS[k] })) : null,
      streak: d.streak, bestStreak: d.bestStreak, bests: d.bests, canSpin: this.phase === 'training' && d.spunRace !== this.race, spinTable: SPIN.map((x) => ({ icon: x.icon, label: x.label })),
      giftFrom: d.giftFrom || null, neighbors: this.phase === 'training' ? [...this.ducks].filter(([x]) => x !== p.id && this.room.get(x)).map(([x, o]) => ({ id: x, owner: this.room.name(x), duck: o.name })) : [], giftIn: Math.max(0, d.giftAt + 30000 - now),
      trainCost: this.s.energy === 'unlimited' ? 0 : TRAIN_COST, runSeconds: RUN_SECONDS, napSeconds: NAP_SECONDS - 3 * d.buildings.coop,
      food: FOOD, pantry: d.pantry, pantryMax: PANTRY_MAX, gear: this.s.gear ? GEAR : null, buildings: BUILDINGS, buildCost: BUILD_COST, decor: DECOR, tactics: TACTICS, badges: BADGES, hats: HATS, colors: COLORS, hatCost: 15,
      predictions: this.s.predictions, rivals: this.s.predictions && this.phase === 'training' ? st.map((x) => ({ id: x.id, duck: x.duck, owner: x.owner })) : [],
      predictWon: this.phase === 'results' ? d.predictWon : null,
      live: this.phase === 'race' ? this.liveFor(p.id) : null,
      rank: st.findIndex((x) => x.id === p.id) + 1, of: st.length,
      final: this.phase === 'over' ? st.slice(0, 10) : null, awards: this.phase === 'over' ? this.awards || [] : null,
      hype: this.phase === 'training' && out0.endsIn <= HYPE_MS, ladder: this.started ? this.ladder() : null,
      projected: this.phase === 'training' && d.gene ? { place: this.etaRanks().get(p.id) || null, of: this.etaRanks().size } : null,
      leader: st[0] && st[0].id !== p.id ? { duck: st[0].duck, points: st[0].points } : null,
      weakest: d.gene && this.course ? this.weakest(d, this.course) : null,
      season: this.phase === 'over' ? {
        rank: st.findIndex((x) => x.id === p.id) + 1, of: st.length, points: d.points, wins: d.wins, podiums: d.trophies.filter((t) => !t.boss).length, best: d.best,
        trained: d.stats.trained, bestScore: d.stats.bestScore, level: this.totalLevel(d), stage: STAGES[d.stage].label, badges: d.badges.length, bestStreak: d.bestStreak, history: d.history,
      } : null,
    };
    d.newBadge = null; d.eventMsg = null; d.questDone = null; d.grew = null; d.giftFrom = null;
    return out;
  }
}

// Party Mode: settings that fit the players in the room and this game's minutes in the plan (box/party-fit.js).
const PF = require('../party-fit');
const partyFit = ({ minutes: M }) => {
  // A season = races × (time on the farm between races + the race itself).
  const { races, raceEvery } = PF.best({ races: [5, 3, 8, 10], raceEvery: [120, 60, 180, 300] }, (s) => 2 + s.races * (s.raceEvery / 60 + 3), M);
  return { races, raceEvery, course: M <= 10 ? 'sprint' : M >= 30 ? 'marathon' : 'classic', energy: M <= 10 ? 'relaxed' : 'normal' };
};

module.exports = {
  partyFit,
  key: 'ducks', name: 'JustRaiseDucks', min: 1, best: [2, 12], fields, defaults, liveLobby: true,
  create: (room, settings) => new Ducks(room, settings),
  _test: { raceShares, BOSS, COMBO, WEATHER, WEATHER_ODDS, WEATHER_TURN, secSkills, secSpeed, secLevel, wfx, SEASON, TREK, SOLO, SEC_OF, racePace, WALL, onWall, ASSIST, baseXp, PAY, XP_FLOOR, SCORE_MAX, RUN_SECONDS, GAME_FOR_SKILL: SKILL_OF_GAME, fatigueDepth, mishap, MISHAP, SKILL_SPEED, sectionSpeed, courseLen, FATIGUE, TRIP_STOP, WRONG_STOP, THINK_STOP, SHORT_BOOST, FORK_GAP, RACE_GRACE, NAP_SECONDS, forkOdds, forksIn, JUMPS, VARIANT, migrate, GAME_FOR, BUILDINGS, FOOD, GEAR, EGGS, level, xpFor, SKILLS, SCORE_RATE, TRAIN_COST, SECTIONS, BUILD_COST, STAGES, LEAGUES, THEMES, TARGET, RISK, riskGoal, PANTRY_MAX, OLD_FOOD, SHORT_SPEED, PERKS, SPIN, HYPE_MS, CHEER_GAP },
};
