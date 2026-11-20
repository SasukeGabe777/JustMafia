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

test('A mini-game started before a race still pays out when it ends during the race', () => {
  const { room, clock } = setup(2, { races: 3, raceEvery: 60 });
  const a = human(room, 'Ann'); go(room);
  const tr = room.act(a, { op: 'train', stat: 'run', diff: 'easy' }); assert(tr.ok, tr.error);
  stepUntil(clock, () => room.game.phase !== 'training');
  const r = room.act(a, { op: 'score', score: 20 });
  assert(r.ok, r.error); assert(r.xp > 0, 'XP for the run');
  assert.equal(room.act(a, { op: 'train', stat: 'run', diff: 'easy' }).ok, false, 'but no new training during the race');
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
      assert(Array.isArray(tr.lv) && tr.lv.length === 5 && tr.lv.every((x) => Number.isInteger(x)), 'levels for the TV');
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

console.log(`\nAll ${passed} JustRaiseDucks tests passed.`);
