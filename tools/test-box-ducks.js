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
  assert(t.ok && t.speed === 1 && t.target === D.TARGET && !('diff' in t), 'an old difficulty value is ignored: one normal pace');
  assert.equal(room.act(a, { op: 'risk' }).ok, false, 'no Risk it! without an offer');
  assert.equal(room.act(a, { op: 'feed', item: 'walnuts' }).ok, false, 'removed foods are off the menu');
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
  assert(D.EGGS.smarts && D.GEAR.map && D.PERKS.compass);
  assert(Object.values(D.BUILDINGS).some((b) => b.skill === 'smarts'));
  const { room, clock } = setup(0, { energy: 'normal' });
  const a = human(room, 'Ann'); go(room);
  const d = room.game.ducks.get(a.id); d.quests = [];
  const t = room.act(a, { op: 'train', stat: 'smarts' }); assert(t.ok && t.game === 'maze', JSON.stringify(t));
  clock.t += 20000;
  const r = room.act(a, { op: 'score', score: 18 });
  assert(r.ok && r.stat === 'smarts' && r.xp > 0 && d.xp.smarts === r.xp, JSON.stringify(r));
  d.xp.smarts = D.xpFor(5); assert.equal(room.game.levels(d).smarts, 5);
  const v = room.playerState(a).state;
  assert.equal(v.duck.levels.smarts, 5); assert(v.duck.progress.smarts && v.duck.progress.smarts.need > 0);
  d.coins = 300;
  assert(room.act(a, { op: 'build', item: 'hedge' }).ok, 'the Hedge Maze building');
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

// ---- Lily Path, the Smarts mini-game: its rules run headless (public/box/games/ducks-mini.js) ----
test('Lily Path: a duck that remembers the frog\'s path scores the target, a guesser barely scores; a wrong pad replays the path; each clear adds a hop', () => {
  const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
  const ctx = { window: {}, location: { search: '' }, localStorage: { getItem: () => null, setItem() {} }, navigator: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/box/games/ducks-mini.js'), 'utf8'), ctx);
  const M = ctx.window.DUCK_MINI;
  assert(M && typeof M.lilyPath === 'function' && typeof M.stop === 'function' && typeof M.active === 'function');
  const seeded = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const run = (diff, pick, seed, gap = 0.6) => {
    const S = M.scorer(), lens = [], rnd = seeded(seed + 99);
    const L = M.lilyPath(diff, seeded(seed), { good: (i, p) => S.good(1, p, true), clear: (len) => { S.good(len - 1, false, true); lens.push(len); }, bad: () => S.bad() });
    L.start(0);
    for (let el = 0; el < 20; el += 0.05) { L.update(el, el < 20 / 3 ? 1 : el < 40 / 3 ? 1.15 : 1.32); if (L.phase === 'input' && el - L.lastTap >= gap) L.tap(pick(L, rnd), el); }
    return { score: S.score, lens };
  };
  const remember = (L) => L.path[L.idx], guess = (L, rnd) => Math.floor(rnd() * L.n);
  for (const diff of ['normal', 'risk']) {
    let good = 0, bad = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const r = run(diff, remember, seed);
      assert(r.score >= (diff === 'normal' ? D.TARGET : D.riskGoal('maze', run('normal', remember, seed).score)), `${diff}: remembering scores the ⭐ target / the Risk it! goal: ${r.score}`);
      assert(r.score <= 60, `${diff}: but not past the score cap: ${r.score}`);
      assert(r.lens.length >= 3 && r.lens.every((x, i) => i === 0 || x === r.lens[i - 1] + 1), 'each path is one hop longer: ' + r.lens);
      good += r.score; bad += run(diff, guess, seed).score;
    }
    assert(bad / 10 < 5 && good > bad * 5, `${diff}: guessing ${bad / 10} vs remembering ${good / 10}`);
  }
  // A wrong pad: a splash, then the frog shows the same path again.
  const L = M.lilyPath('normal', seeded(3)); L.start(0);
  let el = 0; while (L.phase !== 'input') { el += 0.05; L.update(el); }
  const p0 = L.path.slice(), wrongPad = [...Array(L.n).keys()].find((i) => i !== L.path[0]);
  assert.equal(L.tap(L.path[0], el), 'ok'); assert.equal(L.tap(wrongPad, el + 0.3), 'wrong'); assert.equal(L.phase, 'oops');
  assert.equal(L.tap(L.path[0], el + 0.4), 'wait', 'no taps during the splash');
  while (L.phase !== 'show') { el += 0.05; L.update(el); }
  assert.deepEqual(L.path, p0, 'the same path again'); assert.equal(L.len, 3);
  for (let i = 0; i + 1 < L.path.length; i++) { const a = L.path[i], b = L.path[i + 1]; assert(Math.abs((a % L.cols) - (b % L.cols)) <= 1 && Math.abs(Math.floor(a / L.cols) - Math.floor(b / L.cols)) <= 1 && a !== b, 'the frog hops to a neighbouring pad'); }
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
  assert(smart.short / smart.n > 0.28 && dumb.short / dumb.n < 0.2, `shortcuts: smart ${smart.short}/${smart.n}, dumb ${dumb.short}/${dumb.n}`);
  assert(dumb.wrong / dumb.n > 0.2 && smart.wrong / smart.n < 0.1, `wrong turns: dumb ${dumb.wrong}/${dumb.n}, smart ${smart.wrong}/${smart.n}`);
  assert(mapped.wrong > 0 && mapped.wrong < dumb.wrong * 0.75, `the Maze Map cuts wrong turns, never to zero: ${mapped.wrong} vs ${dumb.wrong}`);
  // ...and it shows in the result: a smart duck gets through a maze course faster than a weak one (same everything else).
  let faster = 0; for (let seed = 1; seed <= 12; seed++) { const s = mazeRace(seed, 12), w = mazeRace(seed, 0); const ts = s.R.results.find((x) => x.id === s.a.id).time, tw = w.R.results.find((x) => x.id === w.a.id).time; if (ts < tw) faster++; }
  assert(faster >= 11, 'smart beats weak through the maze: ' + faster + '/12');
  const fo = D.forkOdds; assert(fo(0).wrong > fo(10).wrong && fo(0).short < fo(10).short && fo(0, true).wrong > 0 && fo(25, true, true).wrong > 0);
  // diminishing returns: the first levels of Smarts buy more than the last ones, and the odds level off
  assert(fo(0).wrong - fo(5).wrong > fo(20).wrong - fo(25).wrong && fo(5).short - fo(0).short > fo(25).short - fo(20).short);
  assert(fo(25).short <= 0.5 && fo(25).wrong < 0.04);
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
      assert(C.sections.length >= 4);
      for (const s of C.sections) assert(T.variants[s.type].includes(s.v), `${C.theme}: ${s.type}/${s.v}`);
      assert(C.featured.filter((k) => k !== 'stamina').every((k) => C.sections.some((s) => D.SECTIONS[s.type].skill === k)), 'the featured skills have their sections: ' + C.featured + ' / ' + C.sections.map((s) => s.type));
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
  // a whole 5-race season on Everything has every kind of section (a single race need not)
  const season = (terrain) => { const out = []; for (let seed = 1; seed <= 15; seed++) { const { room } = setup(0, { terrain, races: 5 }, seed); human(room, 'Ann'); go(room); const all = []; for (let n = 1; n <= 5; n++) { room.game.course = room.game.newCourse(n); all.push(...room.game.course.sections.map((s) => s.type)); } out.push(all); } return out; };
  assert(season('mixed').every((t) => ['track', 'pond', 'cliff', 'gap', 'maze'].every((x) => t.includes(x))));
  assert(count('classic').every((t) => !t.includes('maze')));
  assert(season('classic').every((t) => !t.includes('maze') && ['track', 'pond', 'cliff', 'gap'].every((x) => t.includes(x))));
  assert(count('brainy', 'sprint').every((t) => t.includes('maze')), 'Brainy: a maze in every race, even a sprint');
  const mazes = (terrain) => season(terrain).reduce((a, t) => a + t.filter((x) => x === 'maze').length, 0);
  assert(mazes('brainy') > mazes('mixed') * 1.4, 'Brainy: clearly more mazes over a season');
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
  d.energy = D.TRAIN_COST; // enough for one run, then it's out
  assert(room.act(a, { op: 'train', stat: 'run' }).ok); clock.t += 20000;
  const r0 = room.act(a, { op: 'score', score: 12 });
  assert(r0.ok && r0.risk && r0.nap === 0, 'the Risk it! offer comes first: no nap while it is open');
  const r = room.act(a, { op: 'keep' });
  assert(r.ok && r.nap > 0, 'it falls asleep right after the run (once the offer is answered)');
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

// ---- Risk it!: one very hard round after a run; server-side, all six games ----
const riskSetup = (settings = {}) => {
  const { room, clock } = setup(0, { energy: 'normal', raceEvery: 300, catchUp: false, ...settings });
  const a = human(room, 'Ann'); go(room);
  const d = room.game.ducks.get(a.id); d.quests = []; d.mood = 50; d.energy = 100;
  return { room, clock, a, d };
};
const runOnce = (room, clock, a, stat, score = 20) => { const t = room.act(a, { op: 'train', stat }); assert(t.ok, t.error); clock.t += 21000; return room.act(a, { op: 'score', score }); };
test('Risk it!: a run offers one very hard round with a goal; meet it and the run\'s XP doubles, for all six mini-games', () => {
  for (const stat of D.SKILLS) {
    const { room, clock, a, d } = riskSetup();
    const r = runOnce(room, clock, a, stat);
    assert(r.ok && r.xp > 0 && r.risk, stat + ': an offer: ' + JSON.stringify(r));
    assert.equal(r.risk.goal, D.riskGoal(D.GAME_FOR[stat], r.score)); assert(r.risk.goal >= D.RISK.min && r.risk.goal <= D.RISK.max);
    assert.equal(r.risk.win, r.xp); assert.equal(r.risk.lose, r.xp - Math.floor(r.xp / 2));
    assert(room.playerState(a).state.riskOffer && room.playerState(a).state.riskOffer.goal === r.risk.goal, 'the phone sees the offer');
    const e0 = d.energy, x0 = d.xp[stat];
    const k = room.act(a, { op: 'risk' });
    assert(k.ok && k.game === D.GAME_FOR[stat] && k.goal === r.risk.goal && k.seconds === D.RISK.seconds && k.speed > 1, JSON.stringify(k));
    assert.equal(d.energy, e0, 'a risk costs no extra energy');
    assert.equal(room.act(a, { op: 'risk' }).ok, false, 'one risk per run');
    clock.t += (D.RISK.seconds + 1.5) * 1000;
    const w = room.act(a, { op: 'score', score: k.goal });
    assert(w.ok && w.risk === 'win' && w.xp === r.xp, stat + ': the goal is met: ' + JSON.stringify(w));
    assert.equal(d.xp[stat], x0 + r.xp, 'XP doubled'); assert.equal(d.training, null);
    assert(room.fxLog.some((f) => f.kind === 'riskWin' && f.who === a.id));
  }
});
test('Risk it!: miss the goal and the duck falls over and keeps only half of the run\'s XP (never below zero)', () => {
  const { room, clock, a, d } = riskSetup();
  const r = runOnce(room, clock, a, 'stamina', 21);
  const x0 = d.xp.stamina - r.xp; // before the run
  assert(room.act(a, { op: 'risk' }).ok); clock.t += (D.RISK.seconds + 1.5) * 1000;
  const f = room.act(a, { op: 'score', score: r.risk.goal - 1 });
  assert(f.ok && f.risk === 'fall' && f.xp === -(r.xp - Math.floor(r.xp / 2)), JSON.stringify(f));
  assert.equal(d.xp.stamina, x0 + Math.floor(r.xp / 2), 'keeps half');
  assert(room.fxLog.some((x) => x.kind === 'tumble' && x.who === a.id), 'the TV farm shows the fall');
  // A level gained by the run can be lost again by the fall; XP never goes below zero.
  const b = riskSetup(); b.d.xp.run = 0;
  const r2 = runOnce(b.room, b.clock, b.a, 'run', 30); assert(r2.levelUp, 'the run levelled up');
  assert(b.room.act(b.a, { op: 'risk' }).ok); b.clock.t += 17000;
  const f2 = b.room.act(b.a, { op: 'score', score: 0 });
  assert(f2.risk === 'fall' && b.d.xp.run === Math.floor(r2.xp / 2) && b.d.xp.run >= 0);
  assert(f2.levelDown != null || D.level(b.d.xp.run) === r2.levelUp, 'a lost level is reported');
});
test('Risk it! is server-checked: no client-only XP (no offer, forged/early scores, walking away, replays)', () => {
  const { room, clock, a, d } = riskSetup();
  assert.equal(room.act(a, { op: 'risk' }).ok, false, 'no offer, no risk');
  const r = runOnce(room, clock, a, 'swim', 20), x1 = d.xp.swim;
  assert(room.act(a, { op: 'risk' }).ok);
  clock.t += 5000; // a phone that reports a winning score after 5 s of a 15 s round
  const early = room.act(a, { op: 'score', score: 99 });
  assert(early.ok && early.risk === 'fall' && early.score <= Math.floor(5 * D.SCORE_RATE) + 1, 'too early to win (and capped by time): ' + JSON.stringify(early));
  assert.equal(d.xp.swim, x1 - (r.xp - Math.floor(r.xp / 2)));
  assert.equal(room.act(a, { op: 'score', score: 50 }).ok, false, 'nothing left to report');
  // Walking away mid-round: cancel after the countdown is a fall; never reporting back is a fall too.
  const r2 = runOnce(room, clock, a, 'swim', 20), x2 = d.xp.swim;
  assert(room.act(a, { op: 'risk' }).ok); clock.t += 8000;
  const c = room.act(a, { op: 'cancel' }); assert(c.risk === 'fall', JSON.stringify(c)); assert.equal(d.xp.swim, x2 - (r2.xp - Math.floor(r2.xp / 2)));
  d.energy = 100; const r3 = runOnce(room, clock, a, 'swim', 20), x3 = d.xp.swim;
  assert(room.act(a, { op: 'risk' }).ok);
  stepUntil(clock, () => !d.training, 100);
  assert.equal(d.xp.swim, x3 - (r3.xp - Math.floor(r3.xp / 2)), 'a round that never reports back counts as a fall');
  // Cancel during the countdown keeps the XP (the race or the phone stopped it before it began).
  d.energy = 100; const r4 = runOnce(room, clock, a, 'fly', 20), x4 = d.xp.fly;
  assert(room.act(a, { op: 'risk' }).ok); clock.t += 1000;
  assert.equal(room.act(a, { op: 'cancel' }).risk, undefined); assert.equal(d.xp.fly, x4);
  // Keep it: the offer is gone. A new run also keeps the last one. An offer runs out by itself.
  d.energy = 100; runOnce(room, clock, a, 'fly', 20); assert(room.act(a, { op: 'keep' }).ok); assert.equal(room.act(a, { op: 'risk' }).ok, false);
  d.energy = 100; runOnce(room, clock, a, 'fly', 20); assert(d.riskOffer); assert(room.act(a, { op: 'train', stat: 'run' }).ok); assert.equal(d.riskOffer, null);
  clock.t += 21000; room.act(a, { op: 'score', score: 20 }); assert(d.riskOffer);
  stepUntil(clock, () => !d.riskOffer, 100); assert.equal(d.riskOffer, null);
  assert.equal(room.act(a, { op: 'risk' }).ok, false, 'an offer that ran out');
  // No offer for a run that scored nothing.
  d.energy = 100; assert.equal(runOnce(room, clock, a, 'run', 0).risk, undefined, 'nothing to risk');
});
test('Risk it! and the race: no offer right before it; an open offer or a round cut by the race start keeps the XP (or wins if the goal was already met)', () => {
  const { room, clock, a, d } = riskSetup({ raceEvery: 60, races: 6 });
  stepUntil(clock, () => room.game.endsAt - clock.now() <= 25000);
  const late = runOnce(room, clock, a, 'run', 20); // ~4 s left
  assert(late.ok && !late.risk && /race/.test(late.riskNo), 'no time to risk it: ' + JSON.stringify(late));
  room.game.next(); stepUntil(clock, () => room.game.phase === 'training');
  // an open offer when the race starts: kept
  d.energy = 100; const r = runOnce(room, clock, a, 'climb', 20), x0 = d.xp.climb; assert(r.risk);
  room.game.next(); assert.equal(room.game.phase, 'race'); assert.equal(d.riskOffer, null); assert.equal(d.xp.climb, x0);
  stepUntil(clock, () => room.game.phase === 'training');
  // a risk round cut by the race start: kept, or won if the goal was already met
  for (const [score, want] of [[0, 'kept'], [99, 'win']]) {
    d.energy = 100; stepUntil(clock, () => room.game.phase === 'training' && room.game.endsAt - clock.now() > 50000);
    const r2 = runOnce(room, clock, a, 'climb', 20), x2 = d.xp.climb;
    assert(room.act(a, { op: 'risk' }).ok); clock.t += 8000;
    room.game.next(); assert(d.training && d.training.cut);
    const k = room.act(a, { op: 'score', score });
    assert(k.ok && k.risk === want && k.cut, want + ': ' + JSON.stringify(k));
    assert.equal(d.xp.climb, want === 'win' ? x2 + r2.xp : x2);
    stepUntil(clock, () => room.game.phase === 'training');
  }
});
test('Old saves: a difficulty on a run in progress or in the best scores still loads; old foods in a pantry convert', () => {
  const { room, clock, a, d } = riskSetup();
  d.bests = { run: { easy: 12, medium: 18, hard: 9 }, swim: 'junk' };
  d.pantry = { walnuts: 2, cake: 1, seeds: 1, berries: 'x' };
  d.training = { stat: 'run', at: clock.now(), diff: 'hard' }; delete d.riskOffer;
  const v = room.playerState(a).state;
  assert.equal(d.bests.run, 18); assert.equal(d.bests.swim, 0); assert.equal(v.bests.run, 18);
  assert.deepEqual(d.pantry, { seeds: 1, corn: 2, feast: 1 }); assert.deepEqual(Object.keys(v.pantry), Object.keys(D.FOOD));
  clock.t += 20000; const r = room.act(a, { op: 'score', score: 20 }); assert(r.ok && r.xp > 0 && r.risk, 'the old run finishes as a normal run');
  assert(!('diffs' in v) && v.target === D.TARGET);
  assert(D.migrate({ xp: { run: 5 } }).pantry.seeds === 0);
});
// ---- food: three sizes, bought on the training screen ----
test('Food: exactly three, small to big (more energy costs more), no XP or mood; feeding works from the training screen and the pantry', () => {
  const keys = Object.keys(D.FOOD); assert.equal(keys.length, 3);
  const F = keys.map((k) => D.FOOD[k]);
  for (let i = 1; i < F.length; i++) assert(F[i].cost > F[i - 1].cost && F[i].energy > F[i - 1].energy, 'small to big');
  assert(F.every((f) => !f.xp && !f.mood && f.energy > 0 && f.icon && f.label));
  for (const k of Object.keys(D.OLD_FOOD)) assert(!D.FOOD[k] && D.FOOD[D.OLD_FOOD[k]], k + ' maps to a new food');
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '../public/box/games/ducks.js'), 'utf8');
  assert(/function pageTrain[\s\S]*?foodRow\(v, d\)/.test(src) && /data-feed="\$\{k\}"/.test(src), 'the training page has the food row');
  assert(!/walnut/i.test(src) && !/walnut/i.test(require('node:fs').readFileSync(require('node:path').join(__dirname, '../box/games/ducks.js'), 'utf8').replace(/OLD_FOOD = \{[^}]*\}/, '')), 'nothing points at Walnuts');
  const { room, clock, a, d } = riskSetup();
  for (const k of keys) {
    d.energy = 10; d.coins = 100; const c0 = d.coins;
    const r = room.act(a, { op: 'feed', item: k });
    assert(r.ok && !r.stored && r.item === k, JSON.stringify(r)); assert.equal(d.coins, c0 - D.FOOD[k].cost); assert.equal(d.energy, Math.min(100, 10 + D.FOOD[k].energy));
    assert(room.fxLog.some((f) => f.kind === 'eat' && f.item === k && f.who === a.id), 'the TV feeder pops out ' + k);
  }
  // full: what you buy waits in the pantry; next time it is eaten from there (free)
  d.energy = 100; d.coins = 50;
  const s = room.act(a, { op: 'feed', item: 'corn' }); assert(s.ok && s.stored && d.pantry.corn === 1 && d.coins === 50 - D.FOOD.corn.cost);
  assert.equal(room.act(a, { op: 'feed', item: 'corn' }).ok, false, 'full, and one already saved');
  assert.equal(room.playerState(a).state.pantry.corn, 1);
  d.energy = 30; const c1 = d.coins; const e = room.act(a, { op: 'feed', item: 'corn' });
  assert(e.ok && e.fromPantry && d.pantry.corn === 0 && d.coins === c1 && d.energy === 75);
  d.energy = 30; d.coins = 0; assert.equal(room.act(a, { op: 'feed', item: 'seeds' }).ok, false, 'no coins, none saved');
});
// ---- the Stamina mini-game (Bug Snack) is easier; the Risk it! pace is the old hard one ----
test('Bug Snack (Stamina) normal pace is clearly easier than before; Risk it! is harder than normal', () => {
  const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
  const ctx = { window: {}, location: { search: '' }, localStorage: { getItem: () => null, setItem() {} }, navigator: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/box/games/ducks-mini.js'), 'utf8'), ctx);
  const N = ctx.window.DUCK_MINI.bugRules('normal'), R = ctx.window.DUCK_MINI.bugRules('risk');
  const OLD = { life: 1.15, lifeMin: 0.5, bee: 0.2, slop: 10, moveFrom: 1 }; // the old Medium
  assert(N.life >= OLD.life * 1.4 && N.lifeMin >= OLD.lifeMin * 1.8, 'bugs stay up much longer');
  assert(N.bee <= OLD.bee * 0.7 && N.beeLose === 0, 'fewer bees, and a bee only breaks the combo');
  assert(N.slop > OLD.slop && N.moveFrom > OLD.moveFrom && N.perfect > 0.4, 'bigger fingertip slop, bugs walk later, a longer PERFECT window');
  assert(R.life < N.life && R.bee > N.bee && R.slop < N.slop && R.beeLose > 0, 'Risk it! is the hard pace');
  // Enough bugs come up for the ⭐ target (more each stage): well over one per point even at the start pace.
  assert(20 / N.spawn > 1.5 * D.TARGET);
});
/// ---- balance: every skill is worth about the same over a season, and a duck needs all of them (tools/ducks-balance.js) ----
const BAL = require('./ducks-balance');
test('Balance: one skill raised, over the season every skill wins about as often (none more than ~1.6x another)', () => {
  for (const [L, n] of [[4, 4], [10, 4]]) {
    const r = BAL.oneRaised(L, n, { terrain: 'mixed', course: 'classic' }, 300), vals = D.SKILLS.map((k) => r[k]);
    const ratio = Math.max(...vals) / Math.min(...vals);
    assert(ratio <= 1.6, `L${L}+${n}: ${D.SKILLS.map((k) => k + ' ' + (r[k] * 100).toFixed(0) + '%').join(', ')} (${ratio.toFixed(2)}x)`);
  }
});
test('Balance: a well-rounded duck beats a specialist with the same total levels over a season, for every skill', () => {
  const even = BAL.even(5);
  for (const k of D.SKILLS) {
    const lop = BAL.lopsided(30, k), share = BAL.seasonHeadToHead([even, even, even], [lop, lop, lop], {}, 20);
    assert(share >= 0.75, `balanced vs half-in ${k} over a season: ${share.toFixed(2)}`);
  }
});
test('Balance: missing any one skill (at 0, the same total spread over the rest) clearly hurts, for every skill', () => {
  const even = BAL.even(5);
  for (const k of D.SKILLS) {
    const m = BAL.missing(5, k), race = BAL.headToHead([even, even, even], [m, m, m], {}, 60), season = BAL.seasonHeadToHead([even, even, even], [m, m, m], {}, 20);
    assert(race >= 0.6 && season >= 0.75, `balanced vs no ${k}: per race ${race.toFixed(2)}, per season ${season.toFixed(2)}`);
  }
});
test('Seasons: every race features two skills (the final: all), and over 3, 5, 8 or 10 races every skill is featured about equally (never left out)', () => {
  for (const terrain of ['mixed', 'classic', 'brainy']) for (const races of [3, 5, 8, 10]) {
    const sk = terrain === 'classic' ? D.SKILLS.filter((k) => k !== 'smarts') : D.SKILLS;
    for (const c of BAL.seasonSpread(races, terrain, 30)) {
      const v = sk.filter((k) => terrain !== 'brainy' || k !== 'smarts').map((k) => c[k]);
      if (terrain === 'brainy' && races >= 5) assert(c.smarts >= Math.max(...v), 'Brainy: Smarts featured the most');
      assert(Math.max(...v) - Math.min(...v) <= 1 && Math.min(...v) >= 1, `${terrain}/${races}: ${JSON.stringify(c)}`);
      if (terrain === 'classic') assert.equal(c.smarts, 0, 'Classic: no mazes, no Smarts race');
    }
  }
  for (const course of ['sprint', 'classic', 'marathon']) for (const terrain of ['mixed', 'brainy']) for (let seed = 1; seed <= 12; seed++) {
    const { room } = setup(0, { terrain, course, races: 5 }, seed); human(room, 'Ann'); go(room);
    const worlds = [];
    for (let n = 1; n <= 5; n++) {
      const C = room.game.newCourse(n); room.game.course = C; worlds.push(C.theme);
      const types = C.sections.map((s) => s.type);
      if (n < 5) { assert.equal(C.featured.length, 2); assert.notEqual(C.featured[0], C.featured[1]); }
      else for (const t of Object.keys(D.SECTIONS)) assert(types.includes(t), `the final has every kind of section: ${types}`);
      for (const k of C.featured) if (k !== 'stamina') assert(types.filter((t) => D.SECTIONS[t].skill === k).length >= 2 || n === 5, `${k} featured: ${types}`);
      if (n < 5 && C.featured.includes('stamina')) assert(C.endurance, 'a Stamina race is a long one');
      if (terrain === 'brainy') assert(types.includes('maze'), 'Brainy: a maze in every race');
      assert.equal(C.length, C.sections.reduce((a, s) => a + C.secLen[s.type], 0));
      if (course === 'sprint') assert(C.secLen.track < D.SECTIONS.track.len, 'sprint sections are shorter');
    }
    assert.equal(new Set(worlds).size, 5, 'no world twice in a season: ' + worlds);
  }
  // the same seed plans the same season
  const plan = (seed) => { const { room } = setup(0, { races: 8 }, seed); human(room, 'Ann'); go(room); return room.game.plan; };
  assert.deepEqual(plan(4), plan(4));
});
test('Balance: Stamina matters at every level (every duck tires late in the race, less with more Stamina); gear and perks never guarantee anything', () => {
  const depth = D.fatigueDepth;
  assert(depth(0) > 0.4 && depth(0) > depth(5) && depth(5) > depth(12) && depth(12) > depth(20) && depth(25) === 0, [0, 5, 12, 20, 25].map((l) => depth(l).toFixed(2)).join(' '));
  assert(depth(5) - depth(10) > 0.03 && depth(15) - depth(20) > 0.02, 'still worth training late');
  assert(depth(5, { bar: true, lungs: true }) > 0, 'the Energy Bar and Iron Lungs help, never to zero');
  for (const k of ['trip', 'gulp', 'dip', 'slip', 'wrong']) assert(D.mishap(D.MISHAP[k], 0) > 0.25 && D.mishap(D.MISHAP[k], 25) < 0.05 && D.mishap(D.MISHAP[k], 25) > 0, k);
  // a fully geared, perked duck with one skill at 0 still loses most of its head-to-heads to an even duck
  const fo = D.forkOdds(0, true, true); assert(fo.wrong > 0.05, 'Map + Compass still leave a weak-Smarts duck lost sometimes');
});
// ---- fair training for everyone: per-game pay, the XP floor, quiet help, the first-run how-to ----
test('Mini-game pay: the same kind of player earns about the same XP in every game (tools/ducks-minipay.js model)', () => {
  const M = require('./ducks-minipay');
  for (const who of ['struggling', 'casual']) {
    const xs = ['hurdles', 'paddle', 'rings', 'climb', 'bugs', 'maze'].map((g) => M.average(g, M.PLAYERS[who], 600).xp);
    assert(Math.max(...xs) / Math.min(...xs) <= 1.35, `${who}: ${xs.map(Math.round).join(' ')}`);
  }
});
test('XP floor: a full run where you really played earns at least the floor; a cut or empty run does not; good runs earn more', () => {
  const { room } = setup(0, { energy: 'unlimited', catchUp: false }); const a = human(room, 'Ann'); go(room);
  const d = room.game.ducks.get(a.id); d.mood = 50; d.gene = 'run';
  const run = (stat, score) => { assert(room.act(a, { op: 'train', stat }).ok); d.training.at -= (D.RUN_SECONDS + 1) * 1000; const r = room.act(a, { op: 'score', score }); room.act(a, { op: 'keep' }); d.riskOffer = null; d.streak = 0; return r; };
  const low = run('swim', 4); assert.equal(low.xp, D.XP_FLOOR.xp, 'a weak run gets the floor: ' + low.xp);
  const none = run('swim', 1); assert(none.xp < D.XP_FLOOR.xp, 'barely playing: no floor');
  const good = run('swim', 30); assert(good.xp > D.XP_FLOOR.xp * 1.5);
  assert.equal(D.baseXp('swim', 3, false), Math.round(3 * 4 * D.PAY.paddle), 'a run cut by the race: no floor');
});
test('Quiet help: low scores in a game make the next runs of THAT game gentler (slower, wider), good scores take it away; Risk it! never gets it', () => {
  const { room } = setup(0, { energy: 'unlimited' }); const a = human(room, 'Ann'); go(room);
  const d = room.game.ducks.get(a.id);
  const run = (stat, score, keep) => { const t = room.act(a, { op: 'train', stat }); assert(t.ok); d.training.at -= (D.RUN_SECONDS + 1) * 1000; const r = room.act(a, { op: 'score', score }); if (!keep) d.riskOffer = null; return { t, r }; };
  const first = run('fly', 3).t; assert.equal(first.assist, 0); assert.equal(first.speed, 1); assert.equal(first.first, true, 'the first run of a game shows the how-to');
  run('fly', 3); run('fly', 3);
  const helped = run('fly', 3).t; assert.equal(helped.assist, D.ASSIST.max); assert(helped.speed < 1 && helped.speed >= 0.7, 'gentler pace: ' + helped.speed); assert.equal(helped.first, false);
  assert.equal(room.act(a, { op: 'train', stat: 'run' }).assist, 0, 'only the game you struggle with'); room.act(a, { op: 'cancel' });
  for (let i = 0; i < 4; i++) run('fly', 40);
  assert.equal(run('fly', 20).t.assist, 0, 'good runs take the help away');
  // Risk it!: the hard pace, no help
  d.assist.rings = 3; const off = run('fly', 25, true).r; assert(off.risk);
  const rk = room.act(a, { op: 'risk' }); assert(rk.ok && rk.speed === D.RISK.speed && !rk.assist);
  // old saves: no assist/runs yet
  const old = D.migrate({ xp: { run: 50 } }); assert.equal(old.assist.rings, 0); assert.equal(old.runs.maze, 0); assert.equal(D.level(old.xp.run), D.level(50));
});
test('The race shows what each skill does: weak-skill moments, gulps in ponds, dips over ravines, slow climbing on walls; the phone names the weakest skill', () => {
  const { room } = setup(0, { weather: false, races: 5 }, 11); const a = human(room, 'Ann'), b = human(room, 'Bob'); go(room);
  const da = room.game.ducks.get(a.id), db = room.game.ducks.get(b.id);
  for (const k of D.SKILLS) { da.xp[k] = D.xpFor(8); db.xp[k] = D.xpFor(8); }
  da.xp.swim = 0; da.xp.fly = 0; da.xp.climb = 0;
  const C = room.game.course; C.sections = [{ type: 'track', v: 'hurdles' }, { type: 'pond', v: 'calm' }, { type: 'gap', v: 'bridge' }, { type: 'cliff', v: 'vines' }]; C.endurance = false;
  C.length = C.sections.reduce((x, s) => x + C.secLen[s.type], 0);
  const w = room.playerState(a).state.weakest; assert(w && ['swim', 'fly', 'climb'].includes(w.skill) && w.level === 0, JSON.stringify(w));
  assert.equal(room.playerState(b).state.weakest, null, 'an even duck has no weakest skill to point at');
  let gulps = 0, dips = 0, weak = 0;
  for (let i = 0; i < 6; i++) {
    room.game.course = { ...C }; const { entries } = room.game.simulate(); const ea = entries.find((e) => e.id === a.id), eb = entries.find((e) => e.id === b.id);
    gulps += ea.events.filter((e) => e.k === 'gulp').length; dips += ea.events.filter((e) => e.k === 'dip').length; weak += ea.events.filter((e) => e.k === 'weak').length;
    assert(!eb.events.some((e) => e.k === 'weak'));
    assert(ea.time > eb.time, 'missing three skills loses');
  }
  assert(gulps > 0 && dips > 0, `gulps ${gulps}, dips ${dips}`); assert.equal(weak, 6 * 3, 'a weak moment at the pond, the ravine and the cliff every race');
  // climbing walls: a duck on a wall goes slower than on the ledge
  const cliff = [0, 26]; assert(D.onWall(cliff, 0.5) && !D.onWall(cliff, 6) && D.onWall(cliff, 26 * 0.39 + 0.5) && !D.onWall(cliff, 25));
  room.game.next(); const last = da.last; assert(last.weak && last.weak.level === 0, 'after the race the phone says what slowed you down');
});
console.log(`\nAll ${passed} JustRaiseDucks tests passed.`);
