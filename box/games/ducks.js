'use strict';
// JustRaiseDucks: every player gets a farm in Duck Valley (on the big screen) and raises a
// racing duck from their phone. Training mini-games level up Run, Swim, Fly, Climb and
// Stamina; coins buy food, farm buildings, decorations, hats and race-day gear. Every few
// minutes the whole valley races a side-scrolling obstacle course on the TV: a track with
// hurdles, ponds, cliffs to climb and ravines to fly over. Weather, tactics, mood, farm
// events, predictions and badges keep every minute busy.
const SKILLS = ['run', 'swim', 'fly', 'climb', 'stamina'];
const GAME_FOR = { run: 'hurdles', swim: 'paddle', fly: 'rings', climb: 'climb', stamina: 'bugs' };
const SECTIONS = { track: { skill: 'run', len: 80, base: 3.2, per: 0.42 }, pond: { skill: 'swim', len: 60, base: 2.6, per: 0.38 }, cliff: { skill: 'climb', len: 40, base: 1.6, per: 0.26 }, gap: { skill: 'fly', len: 50, base: 3.0, per: 0.42 } };
const COLORS = ['sunny', 'snow', 'cocoa', 'mallard', 'bubblegum', 'sky', 'midnight', 'mint', 'ember', 'lilac'];
const HATS = ['none', 'cap', 'tophat', 'crown', 'flower', 'shades', 'bow', 'viking', 'pirate', 'party', 'chef', 'headband'];
const FOOD = {
  seeds: { label: 'Seeds', icon: '🌾', cost: 5, energy: 20, about: '+20 energy' },
  berries: { label: 'Berries', icon: '🫐', cost: 10, energy: 15, mood: 15, about: '+15 energy, +15 mood' },
  corn: { label: 'Corn', icon: '🌽', cost: 12, energy: 45, about: '+45 energy' },
  worms: { label: 'Worms', icon: '🪱', cost: 18, energy: 25, xp: { stamina: 40 }, about: '+25 energy, +40 Stamina XP' },
  cake: { label: 'Duck Cake', icon: '🍰', cost: 25, energy: 10, mood: 50, about: '+50 mood (a happy duck learns faster)' },
  clover: { label: 'Lucky Clover', icon: '🍀', cost: 30, energy: 25, xp: { weakest: 60 }, about: '+25 energy, +60 XP to your weakest skill' },
};
const GEAR = {
  sneakers: { label: 'Track Sneakers', icon: '👟', cost: 20, about: 'Never trip on a hurdle (next race)' },
  flippers: { label: 'Flippers', icon: '🦶', cost: 20, about: '+10% swimming speed (next race)' },
  glider: { label: 'Glider Wings', icon: '🪁', cost: 20, about: '+10% flying speed (next race)' },
  claws: { label: 'Climbing Claws', icon: '🧗', cost: 20, about: '+10% climbing, half the slips (next race)' },
  energybar: { label: 'Energy Bar', icon: '🍫', cost: 25, about: 'Bigger stamina tank (next race)' },
};
const BUILDINGS = {
  track: { label: 'Running Track', icon: '🏟️', skill: 'run', about: '+20% Run XP per level' },
  pool: { label: 'Lap Pool', icon: '🏊', skill: 'swim', about: '+20% Swim XP per level' },
  tower: { label: 'Wind Tower', icon: '🌬️', skill: 'fly', about: '+20% Fly XP per level' },
  wall: { label: 'Climbing Wall', icon: '🧗', skill: 'climb', about: '+20% Climb XP per level' },
  garden: { label: 'Bug Garden', icon: '🌻', skill: 'stamina', about: '+20% Stamina XP per level' },
  coop: { label: 'Cozy Coop', icon: '🛖', about: 'Naps are shorter and give more energy' },
  feeder: { label: 'Auto Feeder', icon: '🥣', about: 'Energy refills faster on its own' },
};
const BUILD_COST = [40, 90, 160];
const DECOR = { flowers: ['🌷', 'Flower bed', 15], flag: ['🚩', 'Team flag', 15], gnome: ['🧙', 'Garden gnome', 20], lantern: ['🏮', 'Lanterns', 20], scarecrow: ['🎃', 'Scarecrow', 25], fountain: ['⛲', 'Fountain', 40], statue: ['🗿', 'Duck statue', 60], rainbow: ['🌈', 'Rainbow arch', 80] };
const WEATHER = {
  sunny: { icon: '☀️', label: 'Sunny', about: 'Perfect racing weather.' },
  rain: { icon: '🌧️', label: 'Rain', about: 'Slippery hurdles (more trips), faster ponds.' },
  windy: { icon: '💨', label: 'Windy', about: 'A tailwind or headwind over the ravines.' },
  heat: { icon: '🥵', label: 'Heatwave', about: 'Stamina drains 30% faster.' },
  fog: { icon: '🌫️', label: 'Fog', about: 'Nobody can see a thing: extra luck.' },
};
const TACTICS = { steady: ['🐢', 'Steady', 'Saves stamina all race.'], sprint: ['🐇', 'Fast start', 'Faster early, but tires quicker.'], finish: ['🔥', 'Strong finish', 'Slow start, big burst at the end.'] };
const BADGES = {
  firstWin: ['🥇', 'First win', 25], podium: ['🏅', 'On the podium', 10], level5: ['⭐', 'Any skill level 5', 15], level10: ['🌟', 'Any skill level 10', 30],
  allround: ['🎯', 'Every skill level 3+', 30], builder: ['🔨', '3 farm buildings', 20], stylish: ['🎩', '3 hats', 10], oracle: ['🔮', 'Called the winner', 20],
  comeback: ['🚀', 'Top 3 after finishing last', 30], rich: ['💰', '300 coins at once', 0], happy: ['😊', 'Mood 100', 10], champion: ['🏆', 'Won the Grand Duckstakes', 50],
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
const SKILL_NAME = { run: 'Run', swim: 'Swim', fly: 'Fly', climb: 'Climb', stamina: 'Stamina' };
// Eggs: every duck hatches with a natural talent (+25% XP in one skill and a head start).
const EGGS = {
  run: { label: 'Speckled egg', color: '#f2c14e', spots: '#c47f17', about: 'A natural runner' },
  swim: { label: 'Ripple egg', color: '#9ad7ff', spots: '#3d8fd1', about: 'A natural swimmer' },
  fly: { label: 'Cloud egg', color: '#f4f4ff', spots: '#a9b4d6', about: 'A natural flyer' },
  climb: { label: 'Pebble egg', color: '#c9b8a6', spots: '#7a6552', about: 'A natural climber' },
  stamina: { label: 'Sturdy egg', color: '#c7f0a8', spots: '#5e9e3a', about: 'Never runs out of steam' },
};
// Ducks grow up as their skills grow (total of all five levels).
const STAGES = [{ key: 'duckling', label: 'Duckling', from: 0 }, { key: 'young', label: 'Young duck', from: 10 }, { key: 'adult', label: 'Grown duck', from: 25 }, { key: 'champion', label: 'Champion duck', from: 50 }];
const LEAGUES = [
  { key: 'rookie', label: 'Rookie Cup', icon: '🥉', wild: 1 }, { key: 'meadow', label: 'Meadow League', icon: '🌼', wild: 3 },
  { key: 'river', label: 'River League', icon: '🌊', wild: 5 }, { key: 'peak', label: 'Peak League', icon: '⛰️', wild: 8 },
  { key: 'sky', label: 'Sky League', icon: '☁️', wild: 11 }, { key: 'grand', label: 'Grand Championship', icon: '🏆', wild: 14 },
];
// Course themes change the look and the obstacles: each section gets a variant.
const THEMES = {
  meadow: { label: 'Sunny Meadow', weights: { track: 3, pond: 2, cliff: 1, gap: 1 }, variants: { track: ['hurdles', 'mud'], pond: ['lily', 'calm'], cliff: ['rock'], gap: ['clouds'] } },
  beach: { label: 'Seashell Beach', weights: { track: 2, pond: 3, cliff: 1, gap: 1 }, variants: { track: ['sand', 'hurdles'], pond: ['waves'], cliff: ['rock'], gap: ['clouds'] } },
  forest: { label: 'Mossy Forest', weights: { track: 3, pond: 1, cliff: 2, gap: 1 }, variants: { track: ['logs', 'mud'], pond: ['lily', 'calm'], cliff: ['rock'], gap: ['canyon'] } },
  snow: { label: 'Frosty Peaks', weights: { track: 2, pond: 1, cliff: 3, gap: 1 }, variants: { track: ['ice', 'hurdles'], pond: ['icy'], cliff: ['ice'], gap: ['canyon'] } },
  canyon: { label: 'Red Rock Canyon', weights: { track: 2, pond: 1, cliff: 2, gap: 3 }, variants: { track: ['hurdles', 'logs'], pond: ['rapids'], cliff: ['rock'], gap: ['canyon'] } },
  night: { label: 'Firefly Night', weights: { track: 2, pond: 2, cliff: 1, gap: 2 }, variants: { track: ['hurdles', 'logs'], pond: ['lily', 'calm'], cliff: ['rock'], gap: ['clouds'] } },
};
const VARIANT = {
  hurdles: 'Hurdles: jump them (Run helps)', logs: 'Fallen logs: big jumps, more trips', mud: 'Mud: slows weak runners', sand: 'Soft sand: slower running', ice: 'Ice: slippery for everyone',
  calm: 'Calm water', lily: 'Lily pads: hop for a little boost', waves: 'Waves: bumpy swimming', rapids: 'Rapids: fast water', icy: 'Icy water: slow and cold',
  rock: 'Rock face', clouds: 'Cloud updrafts: more boosts', canyon: 'Deep canyon',
};
const WILD = ['Puddles', 'Sir Waddles', 'Biscuit', 'Captain Quack', 'Noodle', 'Pepper', 'Marsh Mallow', 'Drizzle', 'Tumble', 'Pip Squeak', 'Ziggy', 'Rusty', 'Bramble', 'Coco'];
const NAMES = ['Puddle Cup', 'Reed Run', 'Pond Prix', 'Feather Derby', 'Lily Classic', 'Breadcrumb Bowl', 'Cattail Chase', 'Quackathon', 'Splash Open'];
// Training difficulty: easier is cheap and safe, hard is costly and risky but pays far more.
const DIFF = {
  easy: { label: 'Easy', icon: '🌱', mult: 0.7, cost: 10, speed: 0.8, target: 12, wipe: 0, about: 'Slower game, less energy, less XP.' },
  medium: { label: 'Medium', icon: '⚡', mult: 1, cost: 15, speed: 1, target: 16, wipe: 0, about: 'The normal game.' },
  hard: { label: 'Hard', icon: '🔥', mult: 1.7, cost: 22, speed: 1.3, target: 18, wipe: 7, about: 'Fast and tricky. Big XP, but score under 7 and it’s a wipeout (almost nothing).' },
};
// Perks: pick one each time your duck grows up. They change how it races.
const PERKS = {
  burst: { icon: '🚀', label: 'Rocket Start', about: '+15% speed for the first fifth of every race' },
  webbed: { icon: '🦶', label: 'Webbed Pro', about: '+8% speed in ponds' },
  feather: { icon: '🪶', label: 'Featherweight', about: '+8% speed over ravines' },
  grip: { icon: '🧲', label: 'Sure Grip', about: 'Never slips on cliffs' },
  lungs: { icon: '🫁', label: 'Iron Lungs', about: '+40% stamina tank' },
  lucky: { icon: '🍀', label: 'Lucky Feather', about: 'Catches boosts much more often' },
  nimble: { icon: '🦘', label: 'Nimble Feet', about: 'Half as many trips and skids' },
  closer: { icon: '🏁', label: 'Closer', about: '+10% speed in the last fifth of every race' },
};
// Lucky Spin: one free spin each training period.
const SPIN = [
  { w: 22, kind: 'coins', n: 10, label: '10 coins', icon: '🪙' }, { w: 14, kind: 'coins', n: 25, label: '25 coins', icon: '💰' }, { w: 4, kind: 'coins', n: 75, label: 'JACKPOT 75 coins', icon: '🎰' },
  { w: 16, kind: 'energy', n: 40, label: '+40 energy', icon: '⚡' }, { w: 14, kind: 'xp', n: 60, label: '+60 XP', icon: '⭐' }, { w: 10, kind: 'mood', n: 40, label: '+40 mood', icon: '😊' },
  { w: 8, kind: 'gear', label: 'Free race gear', icon: '🎒' }, { w: 6, kind: 'hat', label: 'A new hat', icon: '🎩' }, { w: 6, kind: 'nothing', label: 'A feather… nice?', icon: '🪶' },
];
const RUN_SECONDS = 20, TRAIN_COST = 15, NAP_SECONDS = 15, MAX_LEVEL = 25, SCORE_RATE = 3.2, SCORE_MAX = 60 /* combos let good players score more */;
const RACE_INTRO = 5000, RACE_RUN = 32000, RACE_OUTRO = 6000, RESULT_SHOW = 10000;
const POINTS = [10, 8, 6, 5, 4, 3, 2];
const PRIZE = [40, 30, 22, 16, 12];
const PET_COOLDOWN = 8000;

const xpFor = (L) => 10 * L * L + 10 * L;
const level = (xp) => { let L = 0; while (L < MAX_LEVEL && xp >= xpFor(L + 1)) L++; return L; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const onOff = opt([[true, 'On'], [false, 'Off']]);
const fields = [
  { key: 'raceEvery', label: 'Race every', options: opt([[60, '1 minute'], [120, '2 minutes'], [180, '3 minutes'], [300, '5 minutes']]) },
  { key: 'races', label: 'Races in the season', options: opt([[3, '3 races'], [5, '5 races'], [8, '8 races'], [10, '10 races']]) },
  { key: 'course', label: 'Course length', options: opt([['sprint', 'Sprint (4 sections)'], ['classic', 'Classic (5 sections)'], ['marathon', 'Marathon (8 sections, Stamina matters)']]) },
  { key: 'terrain', label: 'Terrain', options: opt([['mixed', 'Everything (track, pond, cliff, ravine)'], ['track', 'Track only'], ['pond', 'Pond only'], ['mountain', 'Mountain (cliffs and ravines)']]) },
  { key: 'energy', label: 'Energy', options: opt([['normal', 'Normal (food and naps matter)'], ['relaxed', 'Relaxed (refills twice as fast)'], ['unlimited', 'Unlimited (train nonstop)']]) },
  { key: 'startCoins', label: 'Starting coins', options: opt([[30, '30 coins'], [60, '60 coins'], [120, '120 coins']]) },
  { key: 'weather', label: 'Weather', options: onOff },
  { key: 'events', label: 'Farm events (foxes, gifts, traders)', options: onOff },
  { key: 'predictions', label: 'Predict the winner for coins', options: onOff },
  { key: 'gear', label: 'Race-day gear', options: onOff },
  { key: 'catchUp', label: 'Catch-up XP for ducks in the back', options: onOff },
];
const defaults = { raceEvery: 120, races: 5, course: 'classic', terrain: 'mixed', energy: 'normal', startCoins: 60, weather: true, events: true, predictions: true, gear: true, catchUp: true };

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
    return this.ducks.get(p.id);
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
      const now = this.room.now();
      for (const [id, d] of this.ducks) {
        if (!this.room.get(id)) continue;
        const regen = (this.s.energy === 'relaxed' ? 2 : 1) * (1 + 0.5 * d.buildings.feeder) / 3;
        d.energy = Math.min(100, d.energy + regen);
        if (this.room.rng() < 0.12) d.mood = Math.max(0, d.mood - 1);
        if (this.phase === 'training' && this.s.events) this.maybeEvent(id, d, now);
        if (d.event && d.event.until <= now) this.resolveEvent(id, d, null);
      }
      this.tick();
    });
  }

  // ---- season ----
  newCourse(n) {
    const count = ({ sprint: 4, classic: 5, marathon: 8 }[this.s.course] || 5) + Math.floor((n - 1) / 3);
    const pool = { mixed: ['track', 'pond', 'cliff', 'gap'], track: ['track'], pond: ['pond'], mountain: ['cliff', 'gap', 'track'] }[this.s.terrain] || ['track', 'pond', 'cliff', 'gap'];
    const rng = this.room.rng, themeKeys = Object.keys(THEMES);
    let theme; do theme = themeKeys[Math.floor(rng() * themeKeys.length)]; while (theme === (this.course && this.course.theme) && themeKeys.length > 1);
    const T = THEMES[theme];
    const pickType = (prev) => { const opts = pool.filter((x) => pool.length === 1 || x !== prev); const tot = opts.reduce((a, x) => a + T.weights[x], 0); let r = rng() * tot; for (const x of opts) { r -= T.weights[x]; if (r <= 0) return x; } return opts[0]; };
    const types = [pool.includes('track') ? 'track' : pool[0]];
    while (types.length < count) types.push(pickType(types[types.length - 1]));
    if (this.s.terrain === 'mixed') for (const need of ['pond', 'cliff', 'gap']) if (!types.includes(need) && count >= 4) types[1 + Math.floor(rng() * (count - 1))] = need;
    const sections = types.map((type) => { const vs = T.variants[type]; return { type, v: vs[Math.floor(rng() * vs.length)] }; });
    const final = n === this.s.races;
    const league = final ? LEAGUES.length - 1 : Math.min(LEAGUES.length - 2, Math.floor(((n - 1) * (LEAGUES.length - 1)) / Math.max(1, this.s.races - 1)));
    const weathers = Object.keys(WEATHER);
    const weather = this.s.weather ? (n === 1 ? 'sunny' : weathers[Math.floor(this.room.rng() * weathers.length)]) : 'sunny';
    const wind = weather === 'windy' ? (this.room.rng() < 0.5 ? 1 : -1) : 0;
    return { n, final, league, leagueName: LEAGUES[league].label, leagueIcon: LEAGUES[league].icon, theme, themeName: T.label, name: final ? 'Grand Championship' : `${LEAGUES[league].label}: ${NAMES[(n - 1) % NAMES.length]}`, sections, weather, wind, length: sections.reduce((a, x) => a + SECTIONS[x.type].len, 0), variants: VARIANT };
  }
  training() {
    this.phase = 'training';
    this.course = this.newCourse(this.race + 1);
    this.endsAt = this.room.now() + this.s.raceEvery * 1000;
    this.room.cancel(this.timer); this.timer = this.room.after(this.s.raceEvery * 1000, () => this.runRace());
    for (const d of this.ducks.values()) { d.predict = null; this.newQuests(d); }
    const w = WEATHER[this.course.weather];
    this.log(`📣 Next up: ${this.course.name} at ${this.course.themeName}. Forecast: ${w.icon} ${w.label}.`);
    for (const p of this.room.list()) if (p.bot) this.botLoop(p);
  }

  simulate() {
    const C = this.course, entries = [];
    const bounds = []; let acc = 0; for (const x of C.sections) { bounds.push([acc, acc + SECTIONS[x.type].len, x.type, x.v]); acc += SECTIONS[x.type].len; }
    // Jumps: hurdles (every 16 m) or fallen logs (every 22 m, harder) on track sections.
    const hurdles = []; for (const [a, b, s, v] of bounds) if (s === 'track' && (v === 'hurdles' || v === 'logs')) for (let x = a + 12; x < b - 4; x += v === 'logs' ? 22 : 16) hurdles.push({ x, log: v === 'logs' });
    const boosts = []; for (const [a, b, s, v] of bounds) if (s !== 'cliff') { boosts.push({ x: a + (b - a) * 0.55, s }); if (v === 'clouds' || v === 'lily') boosts.push({ x: a + (b - a) * 0.25, s }); }
    const racers = [...this.ducks].filter(([id]) => this.room.get(id));
    // Wild ducks fill the field when only a few people are playing, stronger in higher leagues.
    // Their level follows the field: about as good as the average player duck, tougher in higher leagues.
    const fieldLv = racers.length ? racers.reduce((a, [, d]) => a + SKILLS.reduce((x, k) => x + level(d.xp[k]), 0) / SKILLS.length, 0) / racers.length : 1;
    for (let i = 0; racers.length < 6; i++) {
      const L = Math.max(0, Math.round(fieldLv * (0.55 + 0.11 * (C.league || 0))) + Math.floor(this.room.rng() * 3) - 1);
      racers.push(['w' + i, { wild: true, name: WILD[(this.race * 3 + i) % WILD.length], color: ['cocoa', 'snow', 'mallard', 'sunny', 'midnight', 'ember'][i % 6], hat: ['none', 'cap', 'bow', 'headband', 'none', 'viking'][i % 6], xp: Object.fromEntries(SKILLS.map((k) => [k, xpFor(L)])), mood: 60, energy: 100, tactic: ['steady', 'sprint', 'finish'][i % 3], gear: [], stage: L > 6 ? 2 : 1 }]);
    }
    this.wild = Object.fromEntries(racers.filter(([, d]) => d.wild).map(([id, d]) => [id, { name: d.name, color: d.color, hat: d.hat, stage: d.stage, wild: true }]));
    const L = C.length, DT = 0.1, SAMPLE = 0.5;
    for (const [id, d] of racers) {
      const lv = this.levels(d), gear = new Set(d.gear), rng = this.room.rng;
      const perk = new Set(d.perks || []);
      let x = 0, t = 0, lastV = 1, pool = (30 + 10 * lv.stamina + (gear.has('energybar') ? 20 : 0)) * (perk.has('lungs') ? 1.4 : 1), stopped = 0, tired = false, nextH = 0, nextB = 0, boostUntil = 0;
      const slipAt = {}; bounds.forEach(([a, b, s, v], i) => { if (s === 'cliff') slipAt[i] = a + (b - a) * (0.3 + rng() * 0.5); if (s === 'track' && v === 'ice') slipAt[i] = a + (b - a) * (0.2 + rng() * 0.6); });
      const luck = 0.97 + rng() * 0.06 + (C.weather === 'fog' ? (rng() - 0.5) * 0.1 : 0);
      const samples = [0], events = [];
      while (x < L && t < 400) {
        t += DT;
        if (stopped > 0) { stopped -= DT; } else {
          const si = bounds.findIndex(([a, b]) => x >= a && x < b), [, , sec, vr] = bounds[Math.max(0, si)], S = SECTIONS[sec];
          let v = S.base + S.per * lv[S.skill];
          // Section variants
          if (vr === 'mud') v *= gear.has('sneakers') ? 0.95 : Math.min(1, 0.72 + 0.03 * lv.run);
          if (vr === 'sand') v *= Math.min(1, 0.82 + 0.015 * lv.run);
          if (vr === 'ice') v *= 0.95;
          if (vr === 'rapids') v *= 1.15;
          if (vr === 'icy') v *= Math.min(1, 0.85 + 0.015 * lv.stamina);
          if (vr === 'waves') v *= 0.9 + rng() * 0.2;
          const prog = x / L;
          if (d.tactic === 'sprint') v *= prog < 0.4 ? 1.08 : 1;
          if (d.tactic === 'finish') v *= prog < 0.5 ? 0.95 : prog > 0.7 ? 1.1 : 1;
          if (sec === 'pond' && gear.has('flippers')) v *= 1.1;
          if (sec === 'gap' && gear.has('glider')) v *= 1.1;
          if (sec === 'cliff' && gear.has('claws')) v *= 1.1;
          if (sec === 'pond' && C.weather === 'rain') v *= 1.05;
          if (sec === 'gap' && C.wind) v *= 1 + 0.1 * C.wind;
          if (d.mood < 30) v *= 0.97; else if (d.mood >= 70) v *= 1.02;
          if (d.energy < 20) v *= 0.92;
          if (tired) v *= 0.72;
          if (t < boostUntil) v *= 1.35;
          if (perk.size) { const pg = x / L; if (perk.has('burst') && pg < 0.2) v *= 1.15; if (perk.has('closer') && pg > 0.8) v *= 1.1; if (perk.has('webbed') && sec === 'pond') v *= 1.08; if (perk.has('feather') && sec === 'gap') v *= 1.08; }
          v *= luck;
          const drain = (d.tactic === 'sprint' && prog < 0.4 ? 1.5 : d.tactic === 'steady' ? 0.85 : 1) * (C.weather === 'heat' ? 1.3 : 1);
          pool -= drain * DT;
          if (!tired && pool <= 0) { tired = true; events.push({ t: +t.toFixed(1), id, k: 'tired' }); }
          lastV = v;
          const nx = x + v * DT;
          // Hurdles: a chance to trip (Run level, rain and sneakers matter).
          // Boost pads / currents / updrafts: a better-trained duck catches them more often.
          while (nextB < boosts.length && boosts[nextB].x <= nx) {
            const B = boosts[nextB++];
            if (B.x > x && rng() < (0.25 + 0.04 * lv[SECTIONS[B.s].skill]) * (perk.has('lucky') ? 1.6 : 1)) { boostUntil = t + 1.2; events.push({ t: +t.toFixed(1), id, k: 'boost' }); }
          }
          while (nextH < hurdles.length && hurdles[nextH].x <= nx) {
            if (hurdles[nextH].x > x) {
              const p = gear.has('sneakers') ? 0 : clamp(0.32 - 0.03 * lv.run, 0.03, 0.32) * (C.weather === 'rain' ? 1.6 : 1) * (hurdles[nextH].log ? 1.3 : 1);
              if (rng() < p * (perk.has('nimble') ? 0.5 : 1)) { stopped = 0.9; events.push({ t: +t.toFixed(1), id, k: 'trip' }); }
            }
            nextH++;
          }
          x = stopped > 0 ? Math.min(nx, hurdles[nextH - 1] ? hurdles[nextH - 1].x : nx) : nx;
          if (si >= 0 && slipAt[si] != null && x >= slipAt[si]) {
            const ice = bounds[si][3] === 'ice', p = (sec === 'cliff' && perk.has('grip')) ? 0 : (sec === 'track' && perk.has('nimble') ? 0.5 : 1) * ice && sec === 'track' ? clamp(0.35 - 0.02 * lv.run, 0.08, 0.35) : clamp(0.3 - 0.025 * lv.climb, 0.02, 0.3) * (gear.has('claws') ? 0.5 : 1) * (ice ? 1.6 : 1);
            if (rng() < p) { if (sec === 'track') stopped = 0.8; else x = Math.max(bounds[si][0], x - 5); events.push({ t: +t.toFixed(1), id, k: sec === 'track' ? 'skid' : 'slip' }); }
            delete slipAt[si];
          }
        }
        if (Math.abs(t / SAMPLE - Math.round(t / SAMPLE)) < 1e-6) samples.push(Math.round(Math.min(x, L) * 10));
      }
      const time = t - (x > L ? Math.min(DT, (x - L) / Math.max(0.1, lastV)) : 0); // the moment it crossed the line
      samples.push(Math.round(L * 10));
      entries.push({ id, time, samples, events });
    }
    return { entries, hurdles, boosts: boosts.map((b) => b.x) };
  }
  runRace() {
    if (this.phase !== 'training') return;
    this.race++; this.phase = 'race'; this.room.cancel(this.timer);
    for (const [id, d] of this.ducks) { d.training = null; d.napUntil = 0; d.event = null; if (!d.gene) this.hatch(id, d, 0); }
    const { entries, hurdles, boosts } = this.simulate();
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
      d.last = { place, of: entries.length, pts, coins, time: e.time, trips: e.events.filter((x) => x.k === 'trip').length, slips: e.events.filter((x) => x.k === 'slip').length, tired: e.events.some((x) => x.k === 'tired') };
      d.history.push(place); d.gear = [];
      if (place <= 3) d.trophies.push({ race: this.race, league: this.course.league, place, icon: LEAGUES[this.course.league].icon });
      d.stats.boosts += e.events.filter((x) => x.k === 'boost').length;
      if (place === 1) this.badge(e.id, d, 'firstWin');
      if (place <= 3) this.badge(e.id, d, 'podium');
      if (place <= 3 && wasLast) this.badge(e.id, d, 'comeback');
      if (place === 1 && this.course.final) this.badge(e.id, d, 'champion');
      return { id: e.id, place, time: Math.round(e.time * 100) / 100, pts, coins };
    });
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
    this.lastRace = {
      n: this.race, name: this.course.name, final: this.course.final, sections: this.course.sections, theme: this.course.theme, themeName: this.course.themeName, league: this.course.league, wild: this.wild, weather: this.course.weather, wind: this.course.wind, length: this.course.length, hurdles, boosts,
      intro: RACE_INTRO, run: RACE_RUN, sample: 0.5, results,
      tracks: entries.map((e) => ({ id: e.id, s: e.samples, ev: e.events.map((x) => [x.t, x.k]) })),
    };
    const w = winnerId && (this.ducks.get(winnerId) || this.wild[winnerId]);
    this.room.fx('raceStart');
    this.endsAt = this.room.now() + RACE_INTRO + RACE_RUN + RACE_OUTRO;
    this.timer = this.room.after(RACE_INTRO + RACE_RUN + RACE_OUTRO, () => {
      this.phase = 'results'; this.endsAt = this.room.now() + RESULT_SHOW; this.room.fx('raceDone');
      if (w) this.log(`🏆 ${w.name}${wildWin ? ' (a wild duck!)' : ''} wins the ${this.course.name}!`, 'win');
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
      this.awards = [pretty && ['🌷 Prettiest Farm', pretty[0]], trainer && ['🏋️ Hardest Trainer', trainer[0]], strong && ['💪 Strongest Duck', strong[0]]].filter(Boolean).map(([t, id]) => ({ title: t, id, owner: this.room.name(id), duck: this.ducks.get(id).name }));
      return;
    }
    this.training();
  }
  next() {
    if (this.phase === 'training') this.runRace();
    else if (this.phase === 'race' || this.phase === 'results') { this.room.cancel(this.timer); this.afterRace(); }
  }

  // ---- helpers ----
  levels(d) { const o = {}; for (const s of SKILLS) o[s] = level(d.xp[s]); return o; }
  standings() {
    return [...this.ducks].filter(([id]) => this.room.get(id)).map(([id, d]) => ({ id, owner: this.room.name(id), duck: d.name, points: d.points, wins: d.wins, best: d.best }))
      .sort((a, b) => b.points - a.points || b.wins - a.wins || (a.best || 99) - (b.best || 99));
  }
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
    if (m.op === 'style') {
      if (m.name != null) { const n = String(m.name).replace(/[\u0000-\u001f<>&"]/g, '').trim().slice(0, 18); if (n) d.name = n; }
      if (m.color && COLORS.includes(m.color)) d.color = m.color;
      if (m.hat && d.hats.includes(m.hat)) d.hat = m.hat;
      return { ok: true };
    }
    if (m.op === 'cheer') {
      if (this.phase !== 'race') return { ok: false };
      d.cheers++; this.room.fx('cheer', { id }); return { ok: true };
    }
    if (this.phase === 'over') return { ok: false, error: 'The season is over.' };
    if (m.op === 'hatch') return this.hatch(id, d, Number(m.pick));
    if (m.op === 'perk') {
      if (!d.perkChoice || !d.perkChoice.includes(m.key)) return { ok: false, error: 'Pick one of the offered perks.' };
      d.perks.push(m.key); d.perkChoice = null;
      this.log(`${PERKS[m.key].icon} ${d.name} learned ${PERKS[m.key].label}!`, 'level');
      return { ok: true };
    }
    if (!d.gene && m.op !== 'event') return { ok: false, error: 'Hatch your egg first! 🥚' };
    if (this.phase === 'lobby') return { ok: false, error: 'Waiting for the host to start the game…' };
    if (m.op === 'event') return this.resolveEvent(id, d, String(m.choice || ''));
    if (this.phase !== 'training') return { ok: false, error: 'Race time! Watch the big screen.' };
    switch (m.op) {
      case 'train': {
        if (!SKILLS.includes(m.stat)) return { ok: false, error: 'Pick a skill to train.' };
        if (d.napUntil > now) return { ok: false, error: 'Your duck is napping.' };
        if (d.training && now - d.training.at < (RUN_SECONDS + 15) * 1000) return { ok: false, error: 'Finish your training first.' };
        const diff = DIFF[m.diff] ? m.diff : 'medium';
        const cost = this.s.energy === 'unlimited' ? 0 : DIFF[diff].cost;
        if (d.energy < cost) return { ok: false, error: 'Too tired! Feed your duck or take a nap.' };
        d.energy -= cost; d.training = { stat: m.stat, at: now, diff };
        return { ok: true, game: GAME_FOR[m.stat], seconds: RUN_SECONDS, diff, speed: DIFF[diff].speed, target: DIFF[diff].target, best: (d.bests[m.stat] || {})[diff] || 0 };
      }
      case 'score': {
        const tr = d.training; if (!tr) return { ok: false, error: 'No training in progress.' };
        d.training = null;
        const secs = Math.min(RUN_SECONDS + 2, (now - tr.at) / 1000);
        const score = Math.max(0, Math.min(SCORE_MAX, Math.floor(Number(m.score) || 0), Math.floor(secs * SCORE_RATE) + 1));
        return { ok: true, ...this.reward(id, d, tr.stat, score, tr.diff || 'medium') };
      }
      case 'cancel': d.training = null; return { ok: true };
      case 'nap': {
        if (d.training) return { ok: false, error: 'Finish your training first.' };
        if (d.napUntil > now) return { ok: false, error: 'Already napping.' };
        const secs = NAP_SECONDS - 3 * d.buildings.coop, gain = 35 + 15 * d.buildings.coop;
        d.napUntil = now + secs * 1000;
        this.room.after(secs * 1000, () => { if (d.napUntil && d.napUntil <= this.room.now()) { d.energy = Math.min(100, d.energy + gain); d.mood = Math.min(100, d.mood + 5); d.napUntil = 0; } });
        return { ok: true };
      }
      case 'pet': {
        if (now - d.petAt < PET_COOLDOWN) return { ok: false, error: 'Your duck needs a moment. 🦆' };
        d.petAt = now; d.mood = Math.min(100, d.mood + 6); this.checkBadges(id, d); this.quest(id, d, 'pet'); this.quest(id, d, 'mood', d.mood);
        this.room.fx('pet', { id });
        return { ok: true };
      }
      case 'feed': {
        const f = FOOD[m.item]; if (!f) return { ok: false, error: 'Not on the menu.' };
        if (d.coins < f.cost) return { ok: false, error: 'Not enough coins.' };
        if (!f.mood && !f.xp && d.energy >= 100) return { ok: false, error: 'Your duck is full already.' };
        d.coins -= f.cost; d.energy = Math.min(100, d.energy + (f.energy || 0)); d.mood = Math.min(100, d.mood + (f.mood || 0)); d.stats.foodEaten++;
        if (f.xp) for (const [k, v] of Object.entries(f.xp)) { const s = k === 'weakest' ? SKILLS.slice().sort((a, b) => d.xp[a] - d.xp[b])[0] : k; d.xp[s] += v; }
        this.room.fx('eat', { id }); this.checkBadges(id, d); this.checkGrowth(id, d); this.quest(id, d, 'feed'); this.quest(id, d, 'mood', d.mood);
        return { ok: true };
      }
      case 'build': {
        const b = BUILDINGS[m.item]; if (!b) return { ok: false, error: 'Unknown building.' };
        const lvl = d.buildings[m.item]; if (lvl >= 3) return { ok: false, error: 'Already fully upgraded.' };
        const cost = BUILD_COST[lvl]; if (d.coins < cost) return { ok: false, error: `Needs ${cost} coins.` };
        d.coins -= cost; d.buildings[m.item]++; this.quest(id, d, 'build');
        this.log(`🔨 ${this.room.name(id)} ${lvl ? 'upgraded' : 'built'} a ${b.label}${lvl ? ' (level ' + (lvl + 1) + ')' : ''}.`, 'build');
        this.room.fx('build', { id }); this.checkBadges(id, d);
        return { ok: true };
      }
      case 'decor': {
        const it = DECOR[m.item]; if (!it) return { ok: false, error: 'Unknown decoration.' };
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
        const g = GEAR[m.item]; if (!g) return { ok: false, error: 'Unknown gear.' };
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
      case 'tactic': if (!TACTICS[m.tactic]) return { ok: false, error: 'Unknown tactic.' }; d.tactic = m.tactic; return { ok: true };
      case 'predict': {
        if (!this.s.predictions) return { ok: false, error: 'Predictions are off.' };
        if (!this.ducks.has(m.id) || !this.room.get(m.id)) return { ok: false, error: 'Pick a duck.' };
        d.predict = m.id; return { ok: true };
      }
      default: return { ok: false, error: 'Unknown action.' };
    }
  }
  reward(id, d, stat, score, diff = 'medium') {
    const D = DIFF[diff];
    let xp = score * 4 * D.mult;
    const wipeout = D.wipe && score < D.wipe;
    const star = score >= D.target;
    // Streak: hit the ⭐ target again and again for up to +30% XP; a miss resets it.
    if (star) { d.streak++; d.stars++; d.bestStreak = Math.max(d.bestStreak, d.streak); } else d.streak = 0;
    xp *= 1 + 0.05 * Math.min(6, d.streak);
    if (wipeout) xp *= 0.25;
    const bests = (d.bests[stat] = d.bests[stat] || {}); const newBest = score > (bests[diff] || 0); if (newBest) bests[diff] = score;
    const b = BUILDINGS[Object.keys(BUILDINGS).find((k) => BUILDINGS[k].skill === stat)];
    const bl = b ? d.buildings[Object.keys(BUILDINGS).find((k) => BUILDINGS[k] === b)] : 0;
    xp *= 1 + 0.2 * bl;
    xp *= this.moodMult(d);
    if (d.gene === stat) xp *= 1.25; // natural talent from the egg
    if (this.s.catchUp && this.race > 0) { const st = this.standings(), i = st.findIndex((x) => x.id === id); if (i >= st.length / 2) xp *= 1.5; }
    xp = Math.round(xp);
    const before = level(d.xp[stat]);
    d.xp[stat] += xp; const coins = Math.ceil((score / 2) * (diff === 'easy' ? 0.7 : diff === 'hard' ? 1.5 : 1)) + (star ? 5 : 0); d.coins += coins;
    if (diff === 'hard' && star && score >= 25) this.log(`🔥 ${d.name} crushed a Hard ${SKILL_NAME[stat]} run: ${score}!`, 'level');
    d.mood = Math.max(0, d.mood - 2); d.stats.trained++; d.stats.bestScore = Math.max(d.stats.bestScore, score);
    const after = level(d.xp[stat]);
    this.checkGrowth(id, d);
    if (after > before) { this.room.fx('levelUp', { id }); if (after % 5 === 0) this.log(`⬆️ ${d.name} reached ${stat} level ${after}!`, 'level'); }
    this.checkBadges(id, d); this.quest(id, d, 'train', 1, stat); this.quest(id, d, 'score', score); if (star) this.quest(id, d, 'star');
    return { score, xp, coins, stat, levelUp: after > before ? after : null, mood: d.mood, diff, star, wipeout, streak: d.streak, newBest, target: D.target };
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
      if (d.energy < TRAIN_COST && this.s.energy !== 'unlimited') {
        if (d.coins >= FOOD.corn.cost) this.act(p, { op: 'feed', item: 'corn' }); else if (d.coins >= FOOD.seeds.cost) this.act(p, { op: 'feed', item: 'seeds' }); else this.act(p, { op: 'nap' });
      } else if (cheapest && d.coins >= BUILD_COST[d.buildings[cheapest]] + 30 && r < 0.4) this.act(p, { op: 'build', item: cheapest });
      else {
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
      id, plot: d.plot, owner: this.room.name(id), name: d.name, color: d.color, hat: d.hat, levels: this.levels(d), energy: Math.round(d.energy), mood: Math.round(d.mood),
      points: d.points, wins: d.wins, buildings: d.buildings, decor: d.decor, badges: d.badges.length,
      perks: d.perks, streak: d.streak,
      stage: d.gene ? d.stage : -1, stageName: d.gene ? STAGES[d.stage].label : 'Egg', gene: d.gene, trophies: d.trophies.map((t) => t.place), eggColor: d.gene ? null : EGGS[d.eggs[0]].color,
      busy: d.training ? GAME_FOR[d.training.stat] : d.napUntil > now ? 'nap' : null, event: d.event ? d.event.kind : null,
    };
  }
  tv() {
    const st = this.standings(), rank = new Map(st.map((x, i) => [x.id, i + 1]));
    return {
      phase: this.phase, race: this.race, races: this.s.races, endsIn: this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0,
      course: this.course, weather: WEATHER, tactics: TACTICS, leagues: LEAGUES,
      lastRace: this.lastRace && (this.phase === 'race' || this.phase === 'results' || this.phase === 'over') ? this.lastRace : null,
      farms: [...this.ducks].filter(([id]) => this.room.get(id)).map(([id, d]) => ({ ...this.farmView(id, d), rank: this.race ? rank.get(id) : null })),
      standings: st.slice(0, 10), ticker: this.ticker, awards: this.phase === 'over' ? this.awards || [] : null,
    };
  }
  view(p) {
    const d = this.duck(p), st = this.standings(), now = this.room.now();
    const nextFor = (s) => { const L = level(d.xp[s]); return L >= MAX_LEVEL ? null : { have: d.xp[s] - xpFor(L), need: xpFor(L + 1) - xpFor(L) }; };
    const out = {
      phase: this.phase, race: this.race, races: this.s.races, endsIn: this.endsAt ? Math.max(0, this.endsAt - now) : 0,
      course: this.course, weather: WEATHER, sections: SECTIONS,
      duck: { ...this.farmView(p.id, d), coins: d.coins, hats: d.hats, gear: d.gear, tactic: d.tactic, predict: d.predict, last: d.last, badges: d.badges, progress: Object.fromEntries(SKILLS.map((s) => [s, nextFor(s)])), petIn: Math.max(0, d.petAt + PET_COOLDOWN - now) },
      napLeft: d.napUntil > now ? d.napUntil - now : 0, training: d.training ? { stat: d.training.stat, game: GAME_FOR[d.training.stat] } : null,
      event: d.event ? { kind: d.event.kind, text: d.event.text, choices: d.event.choices, endsIn: Math.max(0, d.event.until - now) } : null, eventMsg: d.eventMsg || null,
      newBadge: d.newBadge || null, questDone: d.questDone || null, grew: d.grew || null,
      eggs: d.gene ? null : d.eggs.map((k) => ({ skill: k, ...EGGS[k] })), gene: d.gene ? { skill: d.gene, ...EGGS[d.gene] } : null, stages: STAGES, trophies: d.trophies, leagues: LEAGUES, variants: VARIANT, themes: Object.fromEntries(Object.entries(THEMES).map(([k, t]) => [k, t.label])),
      quests: d.quests.map((q) => ({ text: q.text, have: Math.min(q.have, q.n), n: q.n, done: q.done, reward: q.reward })),
      rival: d.rival && this.ducks.has(d.rival) ? { name: this.ducks.get(d.rival).name, owner: this.room.name(d.rival) } : null, rivalWon: this.phase === 'results' ? d.rivalWon : null,
      diffs: Object.fromEntries(Object.entries(DIFF).map(([k, x]) => [k, { ...x, cost: this.s.energy === 'unlimited' ? 0 : x.cost }])),
      perks: d.perks.map((k) => ({ key: k, ...PERKS[k] })), perkChoice: d.perkChoice ? d.perkChoice.map((k) => ({ key: k, ...PERKS[k] })) : null,
      streak: d.streak, bestStreak: d.bestStreak, bests: d.bests, canSpin: this.phase === 'training' && d.spunRace !== this.race, spinTable: SPIN.map((x) => ({ icon: x.icon, label: x.label })),
      giftFrom: d.giftFrom || null, neighbors: this.phase === 'training' ? [...this.ducks].filter(([x]) => x !== p.id && this.room.get(x)).map(([x, o]) => ({ id: x, owner: this.room.name(x), duck: o.name })) : [], giftIn: Math.max(0, d.giftAt + 30000 - now),
      trainCost: this.s.energy === 'unlimited' ? 0 : TRAIN_COST, runSeconds: RUN_SECONDS, napSeconds: NAP_SECONDS - 3 * d.buildings.coop,
      food: FOOD, gear: this.s.gear ? GEAR : null, buildings: BUILDINGS, buildCost: BUILD_COST, decor: DECOR, tactics: TACTICS, badges: BADGES, hats: HATS, colors: COLORS, hatCost: 15,
      predictions: this.s.predictions, rivals: this.s.predictions && this.phase === 'training' ? st.map((x) => ({ id: x.id, duck: x.duck, owner: x.owner })) : [],
      predictWon: this.phase === 'results' ? d.predictWon : null,
      rank: st.findIndex((x) => x.id === p.id) + 1, of: st.length,
      final: this.phase === 'over' ? st.slice(0, 10) : null, awards: this.phase === 'over' ? this.awards || [] : null,
    };
    d.newBadge = null; d.eventMsg = null; d.questDone = null; d.grew = null; d.giftFrom = null;
    return out;
  }
}

module.exports = {
  key: 'ducks', name: 'JustRaiseDucks', min: 1, fields, defaults, liveLobby: true,
  create: (room, settings) => new Ducks(room, settings),
  _test: { level, xpFor, SKILLS, SCORE_RATE, TRAIN_COST, SECTIONS, BUILD_COST, STAGES, LEAGUES, THEMES, DIFF, PERKS, SPIN },
};
