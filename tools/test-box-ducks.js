'use strict';
// JustRaiseDucks extras: results() for the party scoreboard, phone input validation, the
// race-day hype cue, projections/favorites, race highlights (photo finishes, season moves),
// the season recap, avatars and cheer spam. Run: node tools/test-box-ducks.js
const assert = require('node:assert/strict');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/ducks');
const D = def._test;

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };
function setup(bots = 0, settings = {}, seed = 7) {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed });
  room.addBots(bots); Object.assign(room.settings, settings);
  return { room, clock };
}
const human = (room, name) => { const p = room.join(name).player; p.sockets = 1; return p; };
const go = (room) => { assert(room.start().ok); for (const [id, d] of room.game.ducks) if (!d.gene) { d.eggs = ['stamina', 'stamina', 'stamina']; room.game.hatch(id, d, 0, true); } };
const stepUntil = (clock, pred, limit = 400000) => { let i = 0; while (!pred()) { if (!clock.step()) throw new Error('clock ran dry'); if (++i > limit) throw new Error('stuck'); } };

test('results(): empty until the season is over, then every player best-first (matches the standings)', () => {
  const { room, clock } = setup(3, { races: 2, raceEvery: 60 });
  const a = human(room, 'Ann'); go(room);
  assert.deepEqual(room.game.results(), []);
  room.game.ducks.get(a.id).xp.run = D.xpFor(15); room.game.ducks.get(a.id).xp.swim = D.xpFor(15);
  stepUntil(clock, () => room.game.phase === 'over');
  const r = room.game.results();
  assert.equal(r.length, 4); assert.equal(new Set(r).size, 4);
  assert.deepEqual(r, room.game.standings().map((x) => x.id));
  const pts = r.map((id) => room.game.ducks.get(id).points);
  assert(pts.every((v, i) => i === 0 || pts[i - 1] >= v), 'best first: ' + pts);
});

test('Phone input: prototype keys and junk never corrupt a duck', () => {
  const { room } = setup(0);
  const a = human(room, 'Ann'); go(room);
  const d = room.game.ducks.get(a.id), coins = d.coins, energy = d.energy;
  for (const k of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
    assert.equal(room.act(a, { op: 'feed', item: k }).ok, false, 'feed ' + k);
    assert.equal(room.act(a, { op: 'build', item: k }).ok, false, 'build ' + k);
    assert.equal(room.act(a, { op: 'decor', item: k }).ok, false, 'decor ' + k);
    assert.equal(room.act(a, { op: 'gear', item: k }).ok, false, 'gear ' + k);
    assert.equal(room.act(a, { op: 'tactic', tactic: k }).ok, false, 'tactic ' + k);
    assert.equal(room.act(a, { op: 'perk', key: k }).ok, false, 'perk ' + k);
  }
  assert.equal(d.coins, coins); assert.equal(d.energy, energy); assert.equal(d.tactic, 'steady');
  const t = room.act(a, { op: 'train', stat: 'run', diff: '__proto__' });
  assert(t.ok && t.diff === 'medium', 'an unknown difficulty falls back to Medium');
  assert(Number.isFinite(d.energy));
  room.act(a, { op: 'cancel' });
  assert.equal(room.act(a, null).ok, false); assert.equal(room.act(a, { op: 'train', stat: { x: 1 } }).ok, false);
  assert.equal(room.act(a, { op: 'hatch', pick: 'length' }).ok, false);
  assert.equal(room.act(a, { op: 'gift', to: { id: 1 } }).ok, false);
  assert(Number.isFinite(d.coins) && Number.isFinite(d.mood));
});

test('Race-day hype: a cue 15 seconds before the race; the TV lists favorites, phones see hype + projection', () => {
  const { room, clock } = setup(4, { raceEvery: 60 });
  const a = human(room, 'Ann'); go(room);
  room.game.ducks.get(a.id).xp.run = D.xpFor(12); room.game.ducks.get(a.id).xp.swim = D.xpFor(12); room.game.ducks.get(a.id).xp.climb = D.xpFor(12); room.game.ducks.get(a.id).xp.fly = D.xpFor(12);
  assert.equal(room.tvState().state.hype, false);
  const v0 = room.playerState(a).state;
  assert.equal(v0.hype, false); assert(v0.projected && v0.projected.place === 1 && v0.projected.of === 5, JSON.stringify(v0.projected));
  stepUntil(clock, () => room.fxLog.some((f) => f.kind === 'hype'));
  assert(room.game.phase === 'training');
  assert(room.game.endsAt - clock.now() <= D.HYPE_MS + 1);
  const tv = room.tvState().state;
  assert(tv.hype && tv.favorites.length === 3 && tv.favorites[0] === a.id, 'the strongest duck is the top favorite');
  assert(room.playerState(a).state.hype);
  assert(/Race day/.test(room.game.ticker[room.game.ticker.length - 1].text));
  // Skipping ahead must not leave a stale hype cue behind.
  room.game.next(); assert.equal(room.game.phase, 'race');
  const n = room.fxLog.filter((f) => f.kind === 'hype').length;
  stepUntil(clock, () => room.game.phase === 'training');
  assert.equal(room.fxLog.filter((f) => f.kind === 'hype').length, n);
});

test('Race highlights: margin, favorites, season moves; ladder of leagues; reward shows level progress', () => {
  const { room, clock } = setup(5, { races: 3, raceEvery: 60 });
  const a = human(room, 'Ann'); go(room);
  const lad = room.tvState().state.ladder;
  assert.equal(lad.length, 3); assert(lad[2].final && lad[2].icon === '🏆'); assert(!lad[0].done);
  room.act(a, { op: 'train', stat: 'run' }); clock.t += 20000;
  const r = room.act(a, { op: 'score', score: 18 });
  assert(r.ok && r.progress && r.progress.need > 0 && r.progress.have >= 0 && r.progress.have < r.progress.need, JSON.stringify(r.progress));
  room.game.next();
  const L = room.game.lastRace;
  assert(typeof L.margin === 'number' && L.margin >= 0);
  assert(Array.isArray(L.favorites) && L.favorites.length === 3);
  assert(Array.isArray(L.highlights));
  for (const id of room.list().map((p) => p.id)) assert(L.moves[id] && L.moves[id][1] >= 1, 'every duck has a season move');
  assert(room.tvState().state.ladder[0].done);
});

test('Season recap on the phone, awards (Loudest Fan), avatars on farms and standings; cheer spam is throttled', () => {
  const { room, clock } = setup(2, { races: 1, raceEvery: 60 });
  const a = human(room, 'Ann'); a.avatar = '🦊'; go(room);
  assert.equal(room.tvState().state.farms.find((f) => f.id === a.id).avatar, '🦊');
  room.game.next(); assert.equal(room.game.phase, 'race');
  const d = room.game.ducks.get(a.id);
  for (let i = 0; i < 20; i++) assert(room.act(a, { op: 'cheer' }).ok);
  assert.equal(d.cheers, 1, 'one cheer per moment');
  clock.t += D.CHEER_GAP + 1; room.act(a, { op: 'cheer' });
  assert.equal(room.game.ducks.get(a.id).cheers, 2);
  stepUntil(clock, () => room.game.phase === 'over');
  const v = room.playerState(a).state;
  assert(v.season && v.season.rank >= 1 && v.season.of === 3 && v.season.history.length === 1);
  assert(v.awards.some((x) => /Loudest Fan/.test(x.title) && x.id === a.id));
  assert.equal(room.tvState().state.standings.find((x) => x.id === a.id).avatar, '🦊');
});

test('A full 100-duck season still runs with the new extras', () => {
  const { room, clock } = setup(100, { races: 2, raceEvery: 60 }, 3);
  go(room); stepUntil(clock, () => room.game.phase === 'over', 3000000);
  assert.equal(room.game.results().length, 100);
});

test('A race start stops training at once: the score so far counts (capped by the time played before the start), nothing after the grace; no new training until the podium is over', () => {
  const { room, clock } = setup(2, { races: 3, raceEvery: 60 });
  const a = human(room, 'Ann'); go(room);
  const d = room.game.ducks.get(a.id); d.quests = [];
  stepUntil(clock, () => room.game.endsAt - clock.now() <= 5000); // 5 seconds before the start
  const tr = room.act(a, { op: 'train', stat: 'run', diff: 'easy' }); assert(tr.ok, tr.error);
  stepUntil(clock, () => room.game.phase !== 'training');
  assert(d.training && d.training.cut, 'the mini-game is cut off at the race start');
  const v = room.playerState(a).state; assert.equal(v.trainLock, 'race'); assert(v.training.cut);
  const no = room.act(a, { op: 'train', stat: 'swim', diff: 'easy' });
  assert.equal(no.ok, false); assert(/Race in progress/.test(no.error), no.error);
  clock.t += 2000;
  const r = room.act(a, { op: 'score', score: 50 });
  assert(r.ok, r.error); assert(r.cut, 'the reward knows it was cut');
  assert(r.score <= Math.floor(5 * D.SCORE_RATE) + 1, 'only the time before the start counts: ' + r.score);
  assert(r.xp > 0, 'fair partial XP');
  // A second phone that waits too long gets nothing.
  const b = human(room, 'Bo'); room.game.hatch(b.id, room.game.ducks.get(b.id), 0, true);
  room.game.next(); assert.equal(room.game.phase, 'training');
  stepUntil(clock, () => room.game.endsAt - clock.now() <= 3000);
  assert(room.act(b, { op: 'train', stat: 'run', diff: 'easy' }).ok);
  stepUntil(clock, () => room.game.phase === 'race');
  const cut = room.game.ducks.get(b.id).training.cut; stepUntil(clock, () => clock.now() > cut + D.RACE_GRACE);
  const late = room.act(b, { op: 'score', score: 5 });
  assert.equal(late.ok, false, 'too late: the race already started');
  assert.equal(room.game.ducks.get(b.id).training, null, 'the cut-off run is cleared');
  stepUntil(clock, () => room.game.phase === 'results');
  assert.equal(room.playerState(a).state.trainLock, 'race', 'still closed on the podium');
  assert.equal(room.act(a, { op: 'train', stat: 'run', diff: 'easy' }).ok, false, 'no training on the podium');
  stepUntil(clock, () => room.game.phase === 'training');
  assert.equal(room.playerState(a).state.trainLock, null);
  d.energy = 100; assert(room.act(a, { op: 'train', stat: 'run', diff: 'easy' }).ok, 'training opens again after the race');
});

// ---- the race the TV animates: per-hurdle outcomes, pacing, levels, the phone's live view ----
const trackRace = (seed, lvRun, settings = {}) => {
  const { room } = setup(0, { terrain: 'track', races: 3, raceEvery: 60, weather: false, ...settings }, seed);
  const a = human(room, 'Ann'); go(room);
  for (const k of D.SKILLS) room.game.ducks.get(a.id).xp[k] = D.xpFor(lvRun);
  room.game.next();
  return { room, a, R: room.game.lastRace };
};
test('Race events: crashes and clipped bars name their hurdle; a crashed duck waits at the fence; tracks carry levels', () => {
  let crashes = 0, clips = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const { R } = trackRace(seed, 0);
    assert(R.hurdles.length >= 3, 'hurdles on a track course');
    for (const tr of R.tracks) {
      assert(Array.isArray(tr.lv) && tr.lv.length === 6 && tr.lv.every((x) => Number.isInteger(x)), 'levels for the TV');
      for (const [t, k, h] of tr.ev) {
        if (k !== 'trip' && k !== 'clip') continue;
        assert(Number.isInteger(h) && R.hurdles[h], 'the event names a real hurdle');
        if (k === 'clip') { clips++; continue; }
        crashes++;
        // the samples around the crash: the duck sits at that hurdle for the dazed stop
        const i0 = Math.ceil(t / R.sample + 1e-9), i1 = Math.floor((t + R.tripStop - 0.11) / R.sample);
        for (let i = i0; i <= i1; i++) assert.equal(tr.s[i], Math.round(R.hurdles[h].x * 10), 'waits at the fence');
      }
    }
  }
  assert(crashes > 0 && clips > 0, `crashes ${crashes}, clips ${clips}`);
});
test('Training shows on the track: a trained runner clears more hurdles cleanly than an untrained one', () => {
  let bad0 = 0, bad12 = 0, n0 = 0, n12 = 0;
  for (let seed = 1; seed <= 20; seed++) {
    for (const [lv, add] of [[0, (b, n) => { bad0 += b; n0 += n; }], [12, (b, n) => { bad12 += b; n12 += n; }]]) {
      const { R, a } = trackRace(seed, lv);
      const tr = R.tracks.find((x) => x.id === a.id);
      add(tr.ev.filter(([, k]) => k === 'trip' || k === 'clip').length, R.hurdles.length);
    }
  }
  assert(bad12 / n12 < (bad0 / n0) * 0.6, `trained ${bad12}/${n12} vs untrained ${bad0}/${n0}`);
});
test('Race pacing: the winner crosses about 34 s in; the whole race (intro + run + outro) fits 30-60 s on the TV (a marathon up to 75 s)', () => {
  for (const [seed, lv, course] of [[2, 0, 'sprint'], [3, 6, 'classic'], [4, 15, 'classic'], [5, 3, 'marathon']]) {
    const { room } = setup(5, { races: 3, raceEvery: 60, course, weather: false }, seed);
    const a = human(room, 'Ann'); go(room);
    for (const k of D.SKILLS) room.game.ducks.get(a.id).xp[k] = D.xpFor(lv);
    room.game.next();
    const R = room.game.lastRace, P = R.pace, win = R.results[0].time, last = R.results[R.results.length - 1].time;
    assert(P.k >= 0.85 && P.k <= 2.2, 'plays at about real speed: ' + P.k);
    assert(Math.abs(win / P.k - P.tw) < 0.01, 'tw is when the winner crosses');
    assert(Math.abs(P.tw * P.k + P.tail * P.k2 - last) < 0.05 || last - win < 0.01, 'the last duck is home by tw + tail');
    const total = (R.intro + R.run + 6000) / 1000;
    assert(total >= 25 && total <= (course === 'marathon' ? 75 : 60), `${course} lv${lv}: ${total}s`);
    assert.equal(room.game.endsAt - room.now(), R.intro + R.run + 6000, 'the server waits exactly as long as the TV plays');
  }
});
test("The phone's live race: during the race your own duck's path and moments, nothing in training", () => {
  const { room, a, R } = trackRace(3, 5);
  const v = room.playerState(a).state;
  assert(v.live, 'live race on the phone');
  const mine = R.tracks.find((x) => x.id === a.id);
  assert.deepEqual(v.live.s, mine.s); assert.deepEqual(v.live.ev, mine.ev);
  assert.deepEqual(v.live.pace, R.pace); assert.equal(v.live.run, R.run);
  assert(v.live.place >= 1 && v.live.of === R.results.length);
  assert(!('tracks' in v.live), 'only your own duck');
  const t = setup(0, {}, 3); const b = human(t.room, 'Bo'); go(t.room);
  assert.equal(t.room.playerState(b).state.live, null);
});

// ---- Smarts, the sixth skill: XP and levels, the maze mini-game, old ducks, gear/perks/eggs ----
test('Smarts is a sixth skill everywhere: training (the maze mini-game) earns XP, levels, eggs, food, a building, a perk, gear', () => {
  assert.deepEqual(D.SKILLS, ['run', 'swim', 'fly', 'climb', 'stamina', 'smarts']);
  assert.equal(D.GAME_FOR.smarts, 'maze'); assert.equal(D.SECTIONS.maze.skill, 'smarts');
  assert(D.EGGS.smarts && D.FOOD.walnuts.xp.smarts > 0 && D.GEAR.map && D.PERKS.compass);
  assert(Object.values(D.BUILDINGS).some((b) => b.skill === 'smarts'));
  const { room, clock } = setup(0, { energy: 'normal' });
  const a = human(room, 'Ann'); go(room);
  const d = room.game.ducks.get(a.id); d.quests = [];
  const t = room.act(a, { op: 'train', stat: 'smarts', diff: 'medium' }); assert(t.ok && t.game === 'maze', JSON.stringify(t));
  clock.t += 20000;
  const r = room.act(a, { op: 'score', score: 18 });
  assert(r.ok && r.stat === 'smarts' && r.xp > 0 && d.xp.smarts === r.xp, JSON.stringify(r));
  d.xp.smarts = D.xpFor(5); assert.equal(room.game.levels(d).smarts, 5);
  const v = room.playerState(a).state;
  assert.equal(v.duck.levels.smarts, 5); assert(v.duck.progress.smarts && v.duck.progress.smarts.need > 0);
  d.coins = 300;
  assert(room.act(a, { op: 'build', item: 'hedge' }).ok, 'the Hedge Maze building');
  d.energy = 50; const x0 = d.xp.smarts; assert(room.act(a, { op: 'feed', item: 'walnuts' }).ok); assert.equal(d.xp.smarts, x0 + 40);
  assert(room.act(a, { op: 'gear', item: 'map' }).ok);
  // A score can't beat the clock: a 4-second maze run can't score 40.
  d.energy = 100; room.act(a, { op: 'train', stat: 'smarts', diff: 'easy' }); clock.t += 4000;
  assert.equal(room.act(a, { op: 'score', score: 40 }).score, Math.floor(4 * D.SCORE_RATE) + 1);
});
test('Old ducks (saved before Smarts) start at Smarts level 0 and keep working: training, views, races', () => {
  const { room, clock } = setup(2, { races: 2, raceEvery: 60 });
  const a = human(room, 'Ann'); go(room);
  const d = room.game.ducks.get(a.id);
  delete d.xp.smarts; delete d.buildings.hedge; delete d.bests; d.napUntil = undefined; // an old save
  const v = room.playerState(a).state;
  assert.equal(v.duck.levels.smarts, 0); assert.equal(d.xp.smarts, 0); assert.equal(d.buildings.hedge, 0);
  assert(room.act(a, { op: 'train', stat: 'smarts', diff: 'easy' }).ok); clock.t += 20000; assert(room.act(a, { op: 'score', score: 12 }).ok);
  const old = room.game.ducks.get(room.list().find((p) => p.bot).id); delete old.xp.smarts; // an old bot too
  room.game.next();
  assert(room.game.lastRace.tracks.every((x) => x.lv.length === 6 && x.lv.every(Number.isInteger)));
  assert(Number.isFinite(room.game.eta(old)));
});

// ---- the maze section: forks decided in the simulation, stat-driven, deterministic ----
const mazeRace = (seed, lv, extra = {}) => {
  const { room } = setup(0, { races: 3, raceEvery: 60, weather: false }, seed);
  const a = human(room, 'Ann'); go(room);
  const d = room.game.ducks.get(a.id);
  for (const k of D.SKILLS) d.xp[k] = D.xpFor(3);
  d.xp.smarts = D.xpFor(lv);
  if (extra.gear) d.gear = extra.gear;
  room.game.course.sections = [{ type: 'track', v: 'hurdles' }, { type: 'maze', v: 'hedge' }, { type: 'maze', v: 'corn' }, { type: 'track', v: 'mud' }];
  room.game.course.length = room.game.course.sections.reduce((s, x) => s + D.SECTIONS[x.type].len, 0);
  room.game.next();
  return { room, a, R: room.game.lastRace };
};
test('Maze forks: every duck meets every fork once (shortcut, think or wrong turn); a wrong turn holds the duck at the fork', () => {
  const { R } = mazeRace(5, 2);
  assert(Array.isArray(R.forks) && R.forks.length >= 4, 'forks in the maze sections: ' + JSON.stringify(R.forks));
  let acc = 0; const mz = []; for (const s of R.sections) { if (s.type === 'maze') mz.push([acc, acc + R.secLen.maze]); acc += R.secLen[s.type]; }
  assert(R.forks.every((x) => mz.some(([a, b]) => x > a && x < b)), 'forks sit inside the mazes');
  let wrongs = 0;
  for (const tr of R.tracks) {
    const fe = tr.ev.filter(([, k]) => k === 'short' || k === 'think' || k === 'wrong');
    assert.deepEqual(fe.map((e) => e[2]), R.forks.map((_, i) => i), 'one choice per fork, in order');
    for (const [t, k, h] of fe) {
      if (k === 'short') continue;
      const stop = k === 'wrong' ? R.wrongStop : R.thinkStop; if (k === 'wrong') wrongs++;
      const i0 = Math.ceil(t / R.sample + 1e-9), i1 = Math.floor((t + stop - 0.11) / R.sample);
      for (let i = i0; i <= i1; i++) assert.equal(tr.s[i], Math.round(R.forks[h] * 10), k + ': waits at the fork');
    }
  }
  assert(wrongs > 0, 'weak ducks take wrong turns');
});
test('Maze forks are deterministic (same seed, same race) and Smarts decides them: smart ducks take shortcuts, weak ones get lost; the Maze Map never gets lost', () => {
  const A1 = mazeRace(9, 4).R, A2 = mazeRace(9, 4).R;
  assert.deepEqual(A1.tracks.map((x) => x.ev), A2.tracks.map((x) => x.ev), 'same seed, same choices');
  assert.deepEqual(A1.results.map((x) => x.id), A2.results.map((x) => x.id));
  const tally = (lv, gear) => { const c = { short: 0, think: 0, wrong: 0, n: 0 }; for (let seed = 1; seed <= 30; seed++) { const { R, a } = mazeRace(seed, lv, { gear }); for (const [, k] of R.tracks.find((x) => x.id === a.id).ev) if (k in c) { c[k]++; c.n++; } } return c; };
  const dumb = tally(0), smart = tally(12), mapped = tally(0, ['map']);
  assert(smart.short / smart.n > 0.6 && dumb.short / dumb.n < 0.2, `shortcuts: smart ${smart.short}/${smart.n}, dumb ${dumb.short}/${dumb.n}`);
  assert(dumb.wrong / dumb.n > 0.25 && smart.wrong / smart.n < 0.08, `wrong turns: dumb ${dumb.wrong}/${dumb.n}, smart ${smart.wrong}/${smart.n}`);
  assert.equal(mapped.wrong, 0, 'the Maze Map never takes a wrong turn');
  // ...and it shows in the result: a smart duck gets through a maze course faster than a weak one (same everything else).
  let faster = 0; for (let seed = 1; seed <= 12; seed++) { const s = mazeRace(seed, 12), w = mazeRace(seed, 0); const ts = s.R.results.find((x) => x.id === s.a.id).time, tw = w.R.results.find((x) => x.id === w.a.id).time; if (ts < tw) faster++; }
  assert(faster >= 11, 'smart beats weak through the maze: ' + faster + '/12');
  const fo = D.forkOdds; assert(fo(0).wrong > fo(10).wrong && fo(0).short < fo(10).short && fo(0, true).wrong === 0);
});

// ---- the race landscapes ----
test('Every theme (at least 12, with its own variants) generates valid courses that can include a maze; every course simulates', () => {
  const keys = Object.keys(D.THEMES);
  assert(keys.length >= 12, 'themes: ' + keys.join(', '));
  for (const k of ['volcano', 'swamp', 'city', 'jungle', 'desert', 'sky', 'candy', 'haunted']) assert(D.THEMES[k], 'theme ' + k);
  for (const [k, T] of Object.entries(D.THEMES)) {
    for (const type of Object.keys(D.SECTIONS)) {
      assert(T.weights[type] > 0, `${k}: ${type} can appear`);
      assert(T.variants[type] && T.variants[type].length, `${k}: a ${type} variant`);
      for (const v of T.variants[type]) assert(D.VARIANT[v], `${k}: ${v} is described`);
    }
  }
  const seen = new Map(keys.map((k) => [k, { n: 0, maze: 0 }]));
  for (let seed = 1; seed <= 60; seed++) {
    const { room } = setup(0, { races: 8, raceEvery: 60 }, seed);
    human(room, 'Ann'); go(room);
    for (let n = 1; n <= 4; n++) {
      const C = room.game.newCourse(n), T = D.THEMES[C.theme];
      assert(T, 'a known theme'); const st = seen.get(C.theme); st.n++;
      assert(C.sections.length >= 5);
      for (const s of C.sections) assert(T.variants[s.type].includes(s.v), `${C.theme}: ${s.type}/${s.v}`);
      assert(['pond', 'cliff', 'gap', 'maze'].every((t) => C.sections.some((s) => s.type === t)), 'Everything: every kind of section: ' + C.sections.map((s) => s.type));
      assert.equal(C.length, C.sections.reduce((x, s) => x + D.SECTIONS[s.type].len, 0));
      if (C.sections.some((s) => s.type === 'maze')) st.maze++;
    }
    // One full race per seed on a random theme: everyone finishes, jumps use the theme's obstacle.
    room.game.course = room.game.newCourse(1); room.game.next();
    const R = room.game.lastRace;
    assert(R.results.every((r) => r.time > 0 && r.time < 400));
    for (const h of R.hurdles) assert(Object.values(D.JUMPS).some(([k]) => k === h.k), 'jump kind ' + h.k);
    for (const tr of R.tracks) assert.equal(tr.s[tr.s.length - 1], R.length * 10);
  }
  for (const [k, st] of seen) if (st.n) assert(st.maze > 0, k + ' had a maze');
  assert([...seen.values()].filter((x) => x.n).length >= 12, 'the themes rotate');
});
test('Terrain: Everything has a maze, Classic never does, Brainy has two or more; Track/Pond/Mountain unchanged', () => {
  const count = (terrain, course = 'classic') => { const out = []; for (let seed = 1; seed <= 15; seed++) { const { room } = setup(0, { terrain, course }, seed); human(room, 'Ann'); go(room); for (let n = 1; n <= 3; n++) out.push(room.game.newCourse(n).sections.map((s) => s.type)); } return out; };
  assert(count('mixed').every((t) => t.includes('maze')));
  assert(count('classic').every((t) => !t.includes('maze') && ['pond', 'cliff', 'gap'].every((x) => t.includes(x))));
  assert(count('brainy', 'sprint').every((t) => t.filter((x) => x === 'maze').length >= 2), 'Brainy: two mazes even in a sprint');
  assert(count('track').every((t) => t.every((x) => x === 'track')));
  assert(count('mountain').every((t) => t.every((x) => ['cliff', 'gap', 'track'].includes(x))));
  assert(def.fields.find((f) => f.key === 'terrain').options.some((o) => o.value === 'brainy'));
});

// ---- naps happen on their own ----
test('Auto-nap: a duck too tired to train falls asleep by itself (no nap button); it can\'t train while asleep, can be fed, and wakes with energy', () => {
  const { room, clock } = setup(0, { energy: 'normal', raceEvery: 300 });
  const a = human(room, 'Ann'); go(room);
  const d = room.game.ducks.get(a.id); d.quests = [];
  assert.equal(room.act(a, { op: 'nap' }).ok, false, 'there is no nap button any more');
  d.energy = 12; // enough for one Easy run, then it's out
  assert(room.act(a, { op: 'train', stat: 'run', diff: 'easy' }).ok); clock.t += 20000;
  const r = room.act(a, { op: 'score', score: 12 });
  assert(r.ok && r.nap > 0, 'it falls asleep right after the run');
  assert(room.fxLog.some((f) => f.kind === 'nap' && f.who === a.id), 'the TV hears about it');
  const v = room.playerState(a).state;
  assert(v.napLeft > 0 && v.napLeft <= v.napTotal, 'the phone shows the nap countdown');
  assert(room.tvState().state.farms.find((f) => f.id === a.id).busy === 'nap', 'the farm shows it sleeping');
  const no = room.act(a, { op: 'train', stat: 'run', diff: 'easy' }); assert.equal(no.ok, false); assert(no.nap && /napping/.test(no.error));
  d.coins = 50; assert(room.act(a, { op: 'feed', item: 'seeds' }).ok, 'feeding is fine while it sleeps');
  assert(d.napUntil > clock.now(), 'but the nap still has to be waited out');
  const e0 = d.energy, until = d.napUntil;
  stepUntil(clock, () => clock.now() >= until && !d.napUntil);
  assert(d.energy >= e0 + 35 - 1e-9, 'wakes up with energy back');
  assert(room.act(a, { op: 'train', stat: 'run', diff: 'easy' }).ok, 'and trains again');
});
test('Auto-nap also catches a tired duck between runs (the farm tick); never in Unlimited energy; a race wakes it', () => {
  const { room, clock } = setup(0, { energy: 'normal', raceEvery: 60 });
  const a = human(room, 'Ann'); go(room);
  const d = room.game.ducks.get(a.id); d.energy = 3;
  stepUntil(clock, () => d.napUntil > 0, 50);
  assert(d.napUntil > clock.now());
  room.game.next(); assert.equal(room.game.phase, 'race'); assert.equal(d.napUntil, 0, 'the race wakes it'); assert(d.energy >= 20, 'with its nap energy (minus the race)');
  const u = setup(0, { energy: 'unlimited' }); const b = human(u.room, 'Bo'); go(u.room);
  const e = u.room.game.ducks.get(b.id); e.energy = 0;
  for (let i = 0; i < 10; i++) u.clock.step();
  assert.equal(e.napUntil, 0, 'no naps with unlimited energy');
  assert(u.room.act(b, { op: 'train', stat: 'run' }).ok);
});
test('Bots never press a nap button (there is none): they eat or fall asleep by themselves, and keep training', () => {
  const { room, clock } = setup(8, { races: 3, raceEvery: 120, energy: 'normal', startCoins: 30 }, 11);
  go(room);
  const ops = []; const act = room.game.act.bind(room.game); room.game.act = (p, m) => { ops.push(m && m.op); return act(p, m); };
  let naps = 0; const fx = room.fx.bind(room); room.fx = (k, data) => { if (k === 'nap') naps++; return fx(k, data); };
  stepUntil(clock, () => room.game.phase === 'over', 3000000);
  assert(!ops.includes('nap'), 'no nap op');
  assert(ops.filter((o) => o === 'train').length > 40, 'bots train');
  assert(naps > 0, 'tired bots fall asleep on their own');
});

console.log(`\nAll ${passed} JustRaiseDucks tests passed.`);
