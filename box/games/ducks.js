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
const NAMES = ['Puddle Cup', 'Reed Run', 'Pond Prix', 'Feather Derby', 'Lily Classic', 'Breadcrumb Bowl', 'Cattail Chase', 'Quackathon', 'Splash Open'];
const RUN_SECONDS = 20, TRAIN_COST = 15, NAP_SECONDS = 15, MAX_LEVEL = 25, SCORE_RATE = 2.2, SCORE_MAX = 45;
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
    this.ducks = new Map(); this.race = 0; this.phase = 'training';
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
        training: null, trainingSince: 0, napUntil: 0, petAt: 0, last: null, history: [], badges: [], event: null, nextEvent: 0, cheers: 0,
        stats: { trained: 0, bestScore: 0, foodEaten: 0 },
      });
      if (this.started) this.log(`🏡 A new farm appears: ${owner}’s farm!`, 'join');
      this.room.fx('farm', { id: p.id });
    }
    return this.ducks.get(p.id);
  }
  start() {
    for (const p of this.room.list()) this.duck(p);
    this.started = true;
    this.log('🌅 Welcome to Duck Valley! Train your ducks, the first race is coming.');
    this.training(); this.tick();
  }
  joined(p) { this.duck(p); }

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
    const sections = [pool.includes('track') ? 'track' : pool[0]];
    while (sections.length < count) {
      let t; let k = 0;
      do t = pool[Math.floor(this.room.rng() * pool.length)]; while (pool.length > 1 && t === sections[sections.length - 1] && ++k < 20);
      sections.push(t);
    }
    if (this.s.terrain === 'mixed') for (const need of ['pond', 'cliff', 'gap']) if (!sections.includes(need) && count >= 4) sections[1 + Math.floor(this.room.rng() * (count - 1))] = need;
    const final = n === this.s.races;
    const weathers = Object.keys(WEATHER);
    const weather = this.s.weather ? (n === 1 ? 'sunny' : weathers[Math.floor(this.room.rng() * weathers.length)]) : 'sunny';
    const wind = weather === 'windy' ? (this.room.rng() < 0.5 ? 1 : -1) : 0;
    return { n, final, name: final ? 'Grand Duckstakes' : NAMES[(n - 1) % NAMES.length], sections, weather, wind, length: sections.reduce((a, s) => a + SECTIONS[s].len, 0) };
  }
  training() {
    this.phase = 'training';
    this.course = this.newCourse(this.race + 1);
    this.endsAt = this.room.now() + this.s.raceEvery * 1000;
    this.room.cancel(this.timer); this.timer = this.room.after(this.s.raceEvery * 1000, () => this.runRace());
    for (const d of this.ducks.values()) d.predict = null;
    const w = WEATHER[this.course.weather];
    this.log(`📣 Next up: the ${this.course.name}. Forecast: ${w.icon} ${w.label}.`);
    for (const p of this.room.list()) if (p.bot) this.botLoop(p);
  }

  simulate() {
    const C = this.course, entries = [];
    const bounds = []; let acc = 0; for (const s of C.sections) { bounds.push([acc, acc + SECTIONS[s].len, s]); acc += SECTIONS[s].len; }
    const hurdles = []; for (const [a, b, s] of bounds) if (s === 'track') for (let x = a + 12; x < b - 4; x += 16) hurdles.push(x);
    const L = C.length, DT = 0.1, SAMPLE = 0.5;
    for (const [id, d] of this.ducks) {
      if (!this.room.get(id)) continue;
      const lv = this.levels(d), gear = new Set(d.gear), rng = this.room.rng;
      let x = 0, t = 0, lastV = 1, pool = 30 + 10 * lv.stamina + (gear.has('energybar') ? 20 : 0), stopped = 0, tired = false, nextH = 0;
      const slipAt = {}; bounds.forEach(([a, b, s], i) => { if (s === 'cliff') slipAt[i] = a + (b - a) * (0.3 + rng() * 0.5); });
      const luck = 0.97 + rng() * 0.06 + (C.weather === 'fog' ? (rng() - 0.5) * 0.1 : 0);
      const samples = [0], events = [];
      while (x < L && t < 400) {
        t += DT;
        if (stopped > 0) { stopped -= DT; } else {
          const si = bounds.findIndex(([a, b]) => x >= a && x < b), [, , sec] = bounds[Math.max(0, si)], S = SECTIONS[sec];
          let v = S.base + S.per * lv[S.skill];
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
          v *= luck;
          const drain = (d.tactic === 'sprint' && prog < 0.4 ? 1.5 : d.tactic === 'steady' ? 0.85 : 1) * (C.weather === 'heat' ? 1.3 : 1);
          pool -= drain * DT;
          if (!tired && pool <= 0) { tired = true; events.push({ t: +t.toFixed(1), id, k: 'tired' }); }
          lastV = v;
          const nx = x + v * DT;
          // Hurdles: a chance to trip (Run level, rain and sneakers matter).
          while (nextH < hurdles.length && hurdles[nextH] <= nx) {
            if (hurdles[nextH] > x) {
              const p = gear.has('sneakers') ? 0 : clamp(0.32 - 0.03 * lv.run, 0.03, 0.32) * (C.weather === 'rain' ? 1.6 : 1);
              if (rng() < p) { stopped = 0.9; events.push({ t: +t.toFixed(1), id, k: 'trip' }); }
            }
            nextH++;
          }
          x = stopped > 0 ? Math.min(nx, hurdles[nextH - 1] || nx) : nx;
          if (si >= 0 && slipAt[si] != null && x >= slipAt[si]) {
            const p = clamp(0.3 - 0.025 * lv.climb, 0.02, 0.3) * (gear.has('claws') ? 0.5 : 1);
            if (rng() < p) { x = Math.max(bounds[si][0], x - 5); events.push({ t: +t.toFixed(1), id, k: 'slip' }); }
            delete slipAt[si];
          }
        }
        if (Math.abs(t / SAMPLE - Math.round(t / SAMPLE)) < 1e-6) samples.push(Math.round(Math.min(x, L) * 10));
      }
      const time = t - (x > L ? Math.min(DT, (x - L) / Math.max(0.1, lastV)) : 0); // the moment it crossed the line
      samples.push(Math.round(L * 10));
      entries.push({ id, time, samples, events });
    }
    return { entries, hurdles };
  }
  runRace() {
    if (this.phase !== 'training') return;
    this.race++; this.phase = 'race'; this.room.cancel(this.timer);
    for (const d of this.ducks.values()) { d.training = null; d.napUntil = 0; d.event = null; }
    const { entries, hurdles } = this.simulate();
    entries.sort((a, b) => a.time - b.time);
    const mult = this.course.final ? 2 : 1;
    const winnerId = entries[0] && entries[0].id;
    const results = entries.map((e, i) => {
      const d = this.ducks.get(e.id), place = i + 1;
      const pts = (POINTS[i] != null ? POINTS[i] : 1) * mult, coins = PRIZE[i] != null ? PRIZE[i] : 8;
      const wasLast = d.history.length && d.history[d.history.length - 1] === d.last.of;
      d.points += pts; d.coins += coins; if (place === 1) { d.wins++; d.mood = Math.min(100, d.mood + 20); }
      d.best = d.best ? Math.min(d.best, place) : place;
      d.energy = Math.max(0, d.energy - 8 * this.course.sections.length / 4);
      d.last = { place, of: entries.length, pts, coins, time: e.time, trips: e.events.filter((x) => x.k === 'trip').length, slips: e.events.filter((x) => x.k === 'slip').length, tired: e.events.some((x) => x.k === 'tired') };
      d.history.push(place); d.gear = [];
      if (place === 1) this.badge(e.id, d, 'firstWin');
      if (place <= 3) this.badge(e.id, d, 'podium');
      if (place <= 3 && wasLast) this.badge(e.id, d, 'comeback');
      if (place === 1 && this.course.final) this.badge(e.id, d, 'champion');
      return { id: e.id, place, time: Math.round(e.time * 100) / 100, pts, coins };
    });
    // Predictions pay out.
    for (const [id, d] of this.ducks) if (d.predict) {
      const r = results.find((x) => x.id === d.predict);
      if (r && r.place === 1) { d.coins += 30; d.predictWon = 30; this.badge(id, d, 'oracle'); } else if (r && r.place <= 3) { d.coins += 10; d.predictWon = 10; } else d.predictWon = 0;
    }
    this.lastRace = {
      n: this.race, name: this.course.name, final: this.course.final, sections: this.course.sections, weather: this.course.weather, wind: this.course.wind, length: this.course.length, hurdles,
      intro: RACE_INTRO, run: RACE_RUN, sample: 0.5, results,
      tracks: entries.map((e) => ({ id: e.id, s: e.samples, ev: e.events.map((x) => [x.t, x.k]) })),
    };
    const w = winnerId && this.ducks.get(winnerId);
    this.room.fx('raceStart');
    this.endsAt = this.room.now() + RACE_INTRO + RACE_RUN + RACE_OUTRO;
    this.timer = this.room.after(RACE_INTRO + RACE_RUN + RACE_OUTRO, () => {
      this.phase = 'results'; this.endsAt = this.room.now() + RESULT_SHOW; this.room.fx('raceDone');
      if (w) this.log(`🏆 ${w.name} wins the ${this.course.name}!`, 'win');
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
    if (m.op === 'event') return this.resolveEvent(id, d, String(m.choice || ''));
    if (this.phase !== 'training') return { ok: false, error: 'Race time! Watch the big screen.' };
    switch (m.op) {
      case 'train': {
        if (!SKILLS.includes(m.stat)) return { ok: false, error: 'Pick a skill to train.' };
        if (d.napUntil > now) return { ok: false, error: 'Your duck is napping.' };
        if (d.training && now - d.training.at < (RUN_SECONDS + 15) * 1000) return { ok: false, error: 'Finish your training first.' };
        const cost = this.s.energy === 'unlimited' ? 0 : TRAIN_COST;
        if (d.energy < cost) return { ok: false, error: 'Too tired! Feed your duck or take a nap.' };
        d.energy -= cost; d.training = { stat: m.stat, at: now };
        return { ok: true, game: GAME_FOR[m.stat], seconds: RUN_SECONDS };
      }
      case 'score': {
        const tr = d.training; if (!tr) return { ok: false, error: 'No training in progress.' };
        d.training = null;
        const secs = Math.min(RUN_SECONDS + 2, (now - tr.at) / 1000);
        const score = Math.max(0, Math.min(SCORE_MAX, Math.floor(Number(m.score) || 0), Math.floor(secs * SCORE_RATE) + 1));
        return { ok: true, ...this.reward(id, d, tr.stat, score) };
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
        d.petAt = now; d.mood = Math.min(100, d.mood + 6); this.checkBadges(id, d);
        this.room.fx('pet', { id });
        return { ok: true };
      }
      case 'feed': {
        const f = FOOD[m.item]; if (!f) return { ok: false, error: 'Not on the menu.' };
        if (d.coins < f.cost) return { ok: false, error: 'Not enough coins.' };
        if (!f.mood && !f.xp && d.energy >= 100) return { ok: false, error: 'Your duck is full already.' };
        d.coins -= f.cost; d.energy = Math.min(100, d.energy + (f.energy || 0)); d.mood = Math.min(100, d.mood + (f.mood || 0)); d.stats.foodEaten++;
        if (f.xp) for (const [k, v] of Object.entries(f.xp)) { const s = k === 'weakest' ? SKILLS.slice().sort((a, b) => d.xp[a] - d.xp[b])[0] : k; d.xp[s] += v; }
        this.room.fx('eat', { id }); this.checkBadges(id, d);
        return { ok: true };
      }
      case 'build': {
        const b = BUILDINGS[m.item]; if (!b) return { ok: false, error: 'Unknown building.' };
        const lvl = d.buildings[m.item]; if (lvl >= 3) return { ok: false, error: 'Already fully upgraded.' };
        const cost = BUILD_COST[lvl]; if (d.coins < cost) return { ok: false, error: `Needs ${cost} coins.` };
        d.coins -= cost; d.buildings[m.item]++;
        this.log(`🔨 ${this.room.name(id)} ${lvl ? 'upgraded' : 'built'} a ${b.label}${lvl ? ' (level ' + (lvl + 1) + ')' : ''}.`, 'build');
        this.room.fx('build', { id }); this.checkBadges(id, d);
        return { ok: true };
      }
      case 'decor': {
        const it = DECOR[m.item]; if (!it) return { ok: false, error: 'Unknown decoration.' };
        if (d.decor.includes(m.item)) return { ok: false, error: 'You have that already.' };
        if (d.coins < it[2]) return { ok: false, error: 'Not enough coins.' };
        d.coins -= it[2]; d.decor.push(m.item); d.mood = Math.min(100, d.mood + 5);
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
        d.coins -= g.cost; d.gear.push(m.item); return { ok: true };
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
  reward(id, d, stat, score) {
    let xp = score * 4;
    const b = BUILDINGS[Object.keys(BUILDINGS).find((k) => BUILDINGS[k].skill === stat)];
    const bl = b ? d.buildings[Object.keys(BUILDINGS).find((k) => BUILDINGS[k] === b)] : 0;
    xp *= 1 + 0.2 * bl;
    xp *= this.moodMult(d);
    if (this.s.catchUp && this.race > 0) { const st = this.standings(), i = st.findIndex((x) => x.id === id); if (i >= st.length / 2) xp *= 1.5; }
    xp = Math.round(xp);
    const before = level(d.xp[stat]);
    d.xp[stat] += xp; const coins = Math.ceil(score / 2); d.coins += coins;
    d.mood = Math.max(0, d.mood - 2); d.stats.trained++; d.stats.bestScore = Math.max(d.stats.bestScore, score);
    const after = level(d.xp[stat]);
    if (after > before) { this.room.fx('levelUp', { id }); if (after % 5 === 0) this.log(`⬆️ ${d.name} reached ${stat} level ${after}!`, 'level'); }
    this.checkBadges(id, d);
    return { score, xp, coins, stat, levelUp: after > before ? after : null, mood: d.mood };
  }

  // ---- bots: train, eat, build, pick tactics ----
  botLoop(p) {
    this.room.after(5000 + this.room.rng() * 12000, () => {
      if (this.phase !== 'training' || !this.room.get(p.id)) return;
      const d = this.duck(p), r = this.room.rng();
      if (d.event) this.resolveEvent(p.id, d, d.event.choices[0][0]);
      if (!d.predict && this.s.predictions) { const ids = [...this.ducks.keys()].filter((x) => this.room.get(x)); this.act(p, { op: 'predict', id: ids[Math.floor(r * ids.length)] }); }
      if (r < 0.15) this.act(p, { op: 'tactic', tactic: Object.keys(TACTICS)[Math.floor(this.room.rng() * 3)] });
      const cheapest = Object.keys(BUILDINGS).filter((k) => d.buildings[k] < 3).sort((a, b) => d.buildings[a] - d.buildings[b])[0];
      if (d.energy < TRAIN_COST && this.s.energy !== 'unlimited') {
        if (d.coins >= FOOD.corn.cost) this.act(p, { op: 'feed', item: 'corn' }); else if (d.coins >= FOOD.seeds.cost) this.act(p, { op: 'feed', item: 'seeds' }); else this.act(p, { op: 'nap' });
      } else if (cheapest && d.coins >= BUILD_COST[d.buildings[cheapest]] + 30 && r < 0.4) this.act(p, { op: 'build', item: cheapest });
      else {
        const need = this.course.sections.map((s) => SECTIONS[s].skill).concat(['stamina']);
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
      busy: d.training ? GAME_FOR[d.training.stat] : d.napUntil > now ? 'nap' : null, event: d.event ? d.event.kind : null,
    };
  }
  tv() {
    const st = this.standings(), rank = new Map(st.map((x, i) => [x.id, i + 1]));
    return {
      phase: this.phase, race: this.race, races: this.s.races, endsIn: this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0,
      course: this.course, weather: WEATHER, tactics: TACTICS,
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
      newBadge: d.newBadge || null,
      trainCost: this.s.energy === 'unlimited' ? 0 : TRAIN_COST, runSeconds: RUN_SECONDS, napSeconds: NAP_SECONDS - 3 * d.buildings.coop,
      food: FOOD, gear: this.s.gear ? GEAR : null, buildings: BUILDINGS, buildCost: BUILD_COST, decor: DECOR, tactics: TACTICS, badges: BADGES, hats: HATS, colors: COLORS, hatCost: 15,
      predictions: this.s.predictions, rivals: this.s.predictions && this.phase === 'training' ? st.map((x) => ({ id: x.id, duck: x.duck, owner: x.owner })) : [],
      predictWon: this.phase === 'results' ? d.predictWon : null,
      rank: st.findIndex((x) => x.id === p.id) + 1, of: st.length,
      final: this.phase === 'over' ? st.slice(0, 10) : null, awards: this.phase === 'over' ? this.awards || [] : null,
    };
    d.newBadge = null; d.eventMsg = null;
    return out;
  }
}

module.exports = {
  key: 'ducks', name: 'JustRaiseDucks', min: 1, fields, defaults,
  create: (room, settings) => new Ducks(room, settings),
  _test: { level, xpFor, SKILLS, SCORE_RATE, TRAIN_COST, SECTIONS, BUILD_COST },
};
