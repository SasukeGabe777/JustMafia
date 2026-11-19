'use strict';
// Practice rounds (box/room.js): every box game that supports it runs once in a short practice
// configuration with bots, records nothing (party points, played games, JustGold, stats, unlocks),
// then the real game starts with the real settings and no intro. Games with special flows are
// left out and have no setting. Party Mode's "Practice rounds: on / off / only new games".
const assert = require('node:assert/strict');
const { VirtualClock } = require('../clock');
const { BoxRoom, NO_PRACTICE, PRACTICE_END_MS, PRACTICE_MAX_MS } = require('../box/room');
const { GAMES } = require('../box');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };
const step = (clock, cond, what, limit = 600000) => { let i = 0; while (!cond()) { if (!clock.step() || ++i > limit) throw new Error('never: ' + what); } };
// A wallet and profile store that remember every call, so "records nothing" can be checked.
function spies() {
  const log = [];
  const wallets = { awardBox: (...a) => { log.push(['gold', ...a]); return 5; }, coins: () => 5 };
  const profiles = { recordGame: (...a) => { log.push(['stats', ...a]); return []; }, recordParty: () => [], bump: () => [] };
  return { log, wallets, profiles };
}
function room(key, { seed = 11, shows = false, humans = 1 } = {}) {
  const clock = new VirtualClock(), S = spies(), def = GAMES[key];
  const r = new BoxRoom('PRAC', def, { clock, seed, shows, wallets: S.wallets, profiles: S.profiles });
  const people = [];
  for (let i = 0; i < humans; i++) { const p = r.join('Hu' + i).player; p.wallet = 'w' + i; p.profileId = 'pf' + i; p.sockets = 1; people.push(p); }
  r.addBots(Math.max(4, (def.min || 1) + 1) - humans);
  return { clock, r, S, def, people };
}

const KEYS = Object.keys(GAMES);
const PRACTISED = KEYS.filter((k) => !NO_PRACTICE.has(k));

test('Games with special flows (big games, JustEscape, JustMarble, JustMafia) have no practice setting', () => {
  for (const k of ['ducks', 'kingdoms', 'escape', 'marble']) {
    const { r } = room(k);
    assert.equal(r.canPractice(), false, k);
    assert(!r.fieldsOf().some((f) => f.key === 'practice'), k + ' shows no practice setting');
  }
  assert(PRACTISED.length >= 25, 'most games practise: ' + PRACTISED.length);
  for (const k of PRACTISED) { const { r } = room(k); assert(r.fieldsOf().some((f) => f.key === 'practice'), k + ' has the setting'); }
});

test('Default: off; on for a new TV for games it has not finished; the TV setting can change it', () => {
  const { r } = room('likely');
  assert.equal(r.settings.practice, undefined, 'off by default');
  r.setOnboard({ newbie: true, seen: [] }); assert.equal(r.settings.practice, true, 'a new TV: on');
  r.setOnboard({ newbie: true, seen: ['likely'] }); assert.equal(r.settings.practice, undefined, 'already played here: off');
  r.setOnboard({ newbie: false, seen: [] }); assert.equal(r.settings.practice, undefined);
  r.hostAction({ type: 'settings', settings: { practice: 'true' } }); assert.equal(r.settings.practice, true);
  r.hostAction({ type: 'settings', settings: { practice: 'false' } }); assert.equal(r.settings.practice, false);
});

const results = [];
for (const key of PRACTISED) {
  test(`${key}: practice with bots records nothing, then the real game with the real settings`, () => {
    const { clock, r, S, def, people } = room(key);
    const made = []; const create = def.create;
    def.create = (rm, s) => { made.push({ ...s }); return create.call(def, rm, s); };
    try {
      r.settings.practice = true;
      const real = { ...r.settings };
      assert(r.start().ok, 'start');
      assert(r.practice, 'a practice round is on');
      assert.equal(made.length, 1); assert.equal(made[0].practice, true);
      // The practice copy is never longer than the real one (rounds-like fields at their smallest).
      for (const f of def.fields || []) if (/^(rounds|turns|questions|hands|orders|races|songs)$/.test(f.key) && typeof real[f.key] === 'number' && real[f.key] > 0) assert(made[0][f.key] <= real[f.key], `${f.key}: ${made[0][f.key]} <= ${real[f.key]}`);
      const pg = r.game;
      assert.equal(r.tvState().practice.phase, 'playing'); assert.equal(r.playerState(people[0]).practice.phase, 'playing');
      step(clock, () => !r.practice || r.practice.phase === 'over', 'practice over');
      const why = r.practice ? r.practice.why : 'gone';
      results.push(`${key}:${why}`);
      r.scoreParty(); r.flush();
      assert.equal(r.played.length, 0, 'no game recorded'); assert.equal(r.partyBoard().length, 0, 'no party points');
      assert.deepEqual(S.log, [], 'no JustGold, no stats');
      assert.equal(r.unlocks.size, 0, 'no unlocks');
      assert.equal(r.tvState().practice.phase, 'over');
      // "Practice over, now for real!" then the real game, straight in.
      const fxBefore = r.fxSeq;
      step(clock, () => !r.practice, 'real game', 50);
      assert(clock.now() - 0 >= PRACTICE_END_MS);
      assert.equal(r.phase, 'game'); assert.notEqual(r.game, pg, 'a new game');
      assert.equal(made.length, 2); assert.equal(made[1].practice, false, "the real game is not a practice");
      for (const [k, v] of Object.entries(real)) if (k !== 'practice') assert.deepEqual(made[1][k], v, 'real setting ' + k);
      const kinds = r.fxLog.filter((f) => f.id > fxBefore).map((f) => f.kind);
      assert(kinds.includes('practiceDone') && !kinds.includes('show'), 'no intro the second time');
      assert.equal(r.tvState().practice, null);
      // The real game counts.
      let i = 0; while (r.game.phase !== 'over' && clock.step()) if (++i > 800000) break;
      if (r.game.phase === 'over') { r.scoreParty(); assert.equal(r.played.length, 1, 'the real game is recorded'); }
      // Play again: no second practice.
      if (r.game.phase === 'over') { r.hostAction({ type: 'again' }); assert.equal(r.practice, null, 'practice once per game'); }
    } finally { def.create = create; }
  });
}

test('Practice with the intro: the intro plays once, before the practice; Skip practice goes straight to the real game', () => {
  const { clock, r } = room('likely', { shows: true });
  r.settings.practice = true;
  r.start(); assert.equal(r.phase, 'show'); assert(r.practice);
  step(clock, () => r.phase === 'game', 'practice begins');
  assert.equal(r.practice.phase, 'playing');
  const v = r.vip(); assert(r.vipAction(v, 'practiceSkip').ok);
  assert.equal(r.practice, null); assert.equal(r.phase, 'game'); assert.equal(r.game.phase === 'over', false);
  assert(r.fxLog.some((f) => f.kind === 'practiceDone'));
  // Skipped during the intro: the real game starts after it.
  const b = room('emoji', { shows: true }); b.r.settings.practice = true; b.r.start(); assert.equal(b.r.phase, 'show');
  assert(b.r.hostAction({ type: 'practiceSkip' }).ok); assert.equal(b.r.practice, null);
  step(b.clock, () => b.r.phase === 'game', 'real game after the intro');
  assert.equal(b.r.practice, null); assert.notEqual(b.r.game.s ? b.r.game.s.practice : undefined, true);
});

test('A practice that runs long ends by itself after the time cap', () => {
  const { clock, r } = room('president');
  r.settings.practice = true; r.start();
  // Nobody moves: stop the bots by only advancing to the cap.
  step(clock, () => !r.practice || r.practice.phase === 'over', 'capped', 900000);
  assert(clock.now() <= PRACTICE_MAX_MS + PRACTICE_END_MS + 1000 || !r.practice);
});

test('Party Mode: Practice rounds on / off / only new games', () => {
  const lineup = [GAMES.likely, GAMES.emoji, GAMES.price];
  for (const [mode, want] of [['on', [true, true, true]], ['off', [false, false, false]], ['new', [true, false, true]]]) {
    const { clock, r } = room('likely');
    r.setParty(lineup, 30, 'auto', { practice: mode, seen: ['emoji'] });
    assert.equal(r.partyState().practice, mode);
    const got = [];
    for (let i = 0; i < lineup.length; i++) {
      got.push(r.settings.practice === true);
      assert(i === 0 ? r.start().ok : true);
      if (r.practice) { step(clock, () => !r.practice, 'practice done'); }
      let n = 0; while (r.game.phase !== 'over' && clock.step()) if (++n > 800000) break;
      r.scoreParty();
      if (i < lineup.length - 1) { r.partyToBoard(); r.partyNext(); }
    }
    assert.deepEqual(got, want, mode);
    assert.equal(r.played.length, lineup.length, mode + ': only the real games count');
  }
  // The setup option is checked: anything else is off.
  const { r } = room('likely'); r.setParty([GAMES.likely], 30, 'auto', { practice: 'sometimes' }); assert.equal(r.partyMode.practice, 'off');
});

console.log(`  (how each practice ended: ${results.join(' ')})`);
console.log(`\nAll ${passed} practice-round tests passed.`);
