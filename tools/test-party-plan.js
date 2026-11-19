'use strict';
// Party Mode plan: each game fits its settings to the crowd and its minutes in the plan
// (box/party-fit.js + each module's partyFit), and the "🎬 Intros" choice (play each / in the
// break / skip) works on the server, through whole parties played by bots.
const assert = require('node:assert/strict');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const { GAMES } = require('../box');
const PF = require('../box/party-fit');
const { CARD_MS } = require('../box/show');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };
const optionOk = (def, k, v) => { const f = def.fields.find((x) => x.key === k); return !!f && (f.options ? f.options.some((o) => o.value === v) : typeof v === 'boolean'); };

test('Every game has a partyFit hook that returns real options for 2/6/15/40 players and 5/10/20 minutes', () => {
  for (const [k, def] of Object.entries(GAMES)) {
    assert.equal(typeof def.partyFit, 'function', k + ' has partyFit');
    for (const players of [2, 6, 15, 40]) for (const minutes of [5, 10, 20]) {
      const raw = def.partyFit({ players, minutes, tier: PF.tier(minutes) });
      assert(raw && typeof raw === 'object' && Object.keys(raw).length, `${k} ${players}/${minutes}: some settings`);
      for (const [key, v] of Object.entries(raw)) assert(optionOk(def, key, v), `${k} ${players}p/${minutes}m: ${key}=${v} is one of its options`);
      const fit = PF.fitSettings(def, { players, minutes });
      assert.deepEqual(Object.keys(fit.settings).sort(), Object.keys(raw).sort(), `${k}: nothing dropped`);
      assert(fit.summary.length >= 1 && fit.summary.length <= 3 && fit.summary.every((s) => typeof s === 'string' && s.length && s.length < 40), `${k}: a short summary (${fit.summary})`);
      // A game built with the fitted settings starts fine.
      const r = new BoxRoom('FITS', def, { clock: new VirtualClock(), seed: 2 });
      Object.assign(r.settings, fit.settings);
      r.addBots(Math.max(def.min, Math.min(players, 12)));
      assert(r.start().ok, `${k} starts with ${JSON.stringify(fit.settings)}`);
    }
  }
});

test('Short slots get shorter games and long slots longer ones (every game changes something)', () => {
  for (const [k, def] of Object.entries(GAMES)) {
    const a = PF.fitSettings(def, { players: 6, minutes: 5 }).settings, b = PF.fitSettings(def, { players: 6, minutes: k === 'kingdoms' ? 45 : 20 }).settings;
    assert.notDeepEqual(a, b, k + ': 5 min and 20 min differ');
  }
  // Counts grow with the time (never shrink).
  const count = { trivia: 'questions', pizza: 'rounds', price: 'rounds', likely: 'rounds', blackjack: 'hands', actout: 'turns', president: 'rounds', escape: 'rooms' };
  for (const [k, key] of Object.entries(count)) {
    let last = 0;
    for (const m of [5, 10, 20, 40]) { const v = PF.fitSettings(GAMES[k], { players: 6, minutes: m }).settings[key]; assert(v >= last, `${k}.${key} grows with minutes`); last = v; }
  }
  // The crowd matters: Who Said It never spotlights more players than are here; big Two Truths groups get a hot-seat cap.
  assert(PF.fitSettings(GAMES.whosaid, { players: 3, minutes: 20 }).settings.spots <= 4);
  assert.equal(PF.fitSettings(GAMES.truths, { players: 6, minutes: 10 }).settings.featured, 'auto');
  assert.notEqual(PF.fitSettings(GAMES.truths, { players: 40, minutes: 10 }).settings.featured, 'auto');
  assert.equal(PF.fitSettings(GAMES.spectrum, { players: 40, minutes: 10 }).settings.names, 'off');
  assert.equal(PF.fitSettings(GAMES.pizza, { players: 6, minutes: 10, difficulty: 'hard' }).summary.join(' · '), '🔴 Hard · 5 orders · 45 seconds · 🎲 Mixed');
  // A game without a hook gets its rounds scaled to the time; bad hook answers are dropped.
  const plain = { key: 'plain', fields: [{ key: 'rounds', options: [{ value: 3, label: '3 rounds' }, { value: 6, label: '6 rounds' }, { value: 12, label: '12 rounds' }] }], defaults: { rounds: 6 } };
  assert.equal(PF.fitSettings(plain, { players: 4, minutes: 24 }).settings.rounds, 12);
  assert.equal(PF.fitSettings(plain, { players: 4, minutes: 5 }).settings.rounds, 3);
  assert.deepEqual(PF.fitSettings({ ...plain, partyFit: () => ({ rounds: 7, nope: 1 }) }, { players: 4, minutes: 5 }).settings, {});
  assert.deepEqual(PF.fitSettings({ ...plain, partyFit: () => { throw new Error('x'); } }, { players: 4, minutes: 5 }).settings, { rounds: 3 });
});

const party = (keys, opts = {}, flow = 'auto') => {
  const clock = new VirtualClock(), r = new BoxRoom('PLAN', GAMES[keys[0]], { clock, seed: 5, shows: true });
  r.setUnlocks(Object.keys(GAMES)); // trivia is an unlockable game
  assert(r.setParty(keys.map((k) => GAMES[k]), 60, flow, opts).ok);
  return { r, clock };
};

test('In a party each game is set up for the players here and its minutes in the plan; the host can still change it in the lobby', () => {
  const { r, clock } = party(['trivia', 'pizza'], { plan: { trivia: 5, pizza: 20 }, players: 6, intros: 'skip', difficulty: 'hard' });
  // Before anyone joins: fitted for the group size picked in the setup.
  assert.equal(r.settings.questions, PF.fitSettings(GAMES.trivia, { players: 6, minutes: 5, difficulty: 'hard' }).settings.questions);
  assert.deepEqual(r.tvState().partyMode.fit.summary, PF.fitSettings(GAMES.trivia, { players: 6, minutes: 5, difficulty: 'hard' }).summary);
  r.join('Ana'); r.addBots(2);
  assert(r.start().ok);
  assert.equal(r.partyMode.fit.players, 3, 'fitted again at Start for the 3 players actually here');
  assert.deepEqual(r.tvState().partyMode.plan, [5, 20]);
  while (r.phase !== 'game' && clock.step());
  assert.equal(r.game.s.seconds, 10, 'a 5-minute trivia slot uses the quick timer');
  let i = 0; while (r.partyMode.phase !== 'board' && clock.step()) { r.scoreParty(); if (++i > 500000) throw new Error('stuck'); }
  const up = r.tvState().partyMode.upNext;
  assert.equal(up.game, 'pizza'); assert.equal(up.n, 2); assert.equal(up.minutes, 20);
  assert.deepEqual(up.summary, PF.fitSettings(GAMES.pizza, { players: 3, minutes: 20, difficulty: 'hard' }).summary, 'the board shows the next game’s settings');
  assert.equal(r.playerState(r.list()[0]).partyMode.upNext.game, 'pizza', 'phones see it too');
  while (r.partyMode.phase === 'board' && clock.step());
  assert.equal(r.def.key, 'pizza'); assert.equal(r.game.s.rounds, 8); assert.equal(r.game.s.seconds, 60);

  // "Let the host adjust": the fitted settings are pre-filled; the host's change stands.
  const L = party(['pizza', 'trivia'], { plan: { pizza: 5, trivia: 10 } }, 'lobby');
  L.r.join('Bo'); L.r.addBots(3);
  assert.equal(L.r.settings.rounds, 3, 'pre-filled for a 5-minute slot');
  assert(L.r.hostAction({ type: 'settings', settings: { rounds: 8 } }).ok);
  assert(L.r.start().ok); assert.equal(L.r.game.s.rounds, 8, 'the host’s choice');
  assert.equal(L.r.tvState().partyMode.fit.touched, true);
});

// Play a whole party with bots; record what the intros did for each game.
function playParty(intros, keys = ['likely', 'price', 'emoji', 'trivia']) {
  const { r, clock } = party(keys, { intros, each: 'quick', plan: Object.fromEntries(keys.map((k) => [k, 5])), players: 6 });
  r.join('Ana'); r.addBots(5);
  assert(r.start().ok);
  const seen = {}; let previews = 0, i = 0;
  const note = () => {
    const g = r.def.key, s = (seen[g] = seen[g] || { steps: new Set(), modes: new Set(), info: null });
    if (r.phase === 'show' && r.show) { s.steps.add(r.show.step); s.modes.add(r.show.mode); s.info = s.info || r.show.tv().info; }
    const pm = r.tvState().partyMode;
    if (pm.preview) { previews++; seen[pm.preview.game] = seen[pm.preview.game] || { steps: new Set(), modes: new Set(), info: null }; seen[pm.preview.game].preview = pm.preview.step; assert.equal(pm.phase, 'board'); }
  };
  while (r.partyMode.phase !== 'done') {
    note();
    if (!clock.step()) throw new Error('clock ran dry');
    r.scoreParty();
    if (++i > 2000000) throw new Error('party never finished');
  }
  return { r, seen, previews };
}

test('Intros "play each": every game opens with its cutscene and the how-to steps (as before)', () => {
  const { r, seen, previews } = playParty('play');
  assert.equal(r.played.length, 4); assert.equal(previews, 0);
  for (const k of ['likely', 'price', 'emoji', 'trivia']) { assert(seen[k].steps.has('intros') && seen[k].steps.has('howto'), k); assert.equal(seen[k].info.n, ['likely', 'price', 'emoji', 'trivia'].indexOf(k) + 1); }
  assert(seen.price.steps.has('facts'), 'the game show still collects fun facts');
});

test('Intros "skip": a short title card (with the game’s settings) and straight in', () => {
  const { r, seen, previews } = playParty('skip');
  assert.equal(r.played.length, 4); assert.equal(previews, 0);
  for (const k of ['likely', 'price', 'emoji', 'trivia']) {
    assert.deepEqual([...seen[k].modes], ['card'], k); assert(!seen[k].steps.has('intros') && !seen[k].steps.has('howto'), k);
    assert(seen[k].info.summary.length, k + ': the card shows its settings');
  }
  assert.equal(CARD_MS <= 5000, true);
});

test('Intros "in the break": the first plays as the party starts (no how-to); the rest play during the standings, then each game starts straight away', () => {
  const { r, seen, previews } = playParty('break');
  assert.equal(r.played.length, 4); assert(previews > 0);
  assert.deepEqual([...seen.likely.modes], ['cast']); assert(!seen.likely.steps.has('howto'), 'the opener skips the how-to');
  for (const k of ['price', 'emoji', 'trivia']) {
    assert.equal(seen[k].steps.size, 0, k + ' starts with no intro of its own');
    assert.equal(seen[k].preview, 'intros', k + '’s intro played in the break');
  }
  // The break is long enough for the intro; phones are not sent the cutscene.
  const { r: r2, clock } = party(['likely', 'trivia'], { intros: 'break' });
  r2.join('Ana'); r2.addBots(3); assert(r2.start().ok);
  while (r2.partyMode.phase !== 'board' && clock.step()) r2.scoreParty();
  assert(r2.tvState().partyMode.in >= 15000);
  while (!r2.partyMode.preview && clock.step());
  assert(r2.tvState().partyMode.preview && r2.tvState().partyMode.preview.game === 'trivia');
  assert.equal(r2.playerState(r2.list()[0]).partyMode.preview, null);
  // "Next game now" during the intro: it counts as played, the game starts straight away.
  assert(r2.hostAction({ type: 'partyNext' }).ok);
  assert.equal(r2.def.key, 'trivia'); assert.equal(r2.phase, 'game');
});

test('The host can change the intros mid-party (⚙ menu); a bad value is refused; lobby flow still works', () => {
  const { r, clock } = party(['likely', 'trivia', 'emoji'], { intros: 'play' });
  r.join('Ana'); r.addBots(3); assert(r.start().ok);
  assert.equal(r.hostAction({ type: 'partyIntros', mode: 'nope' }).ok, false);
  assert(r.hostAction({ type: 'partyIntros', mode: 'skip' }).ok); assert.equal(r.tvState().partyMode.intros, 'skip');
  while (r.partyMode.phase !== 'board' && clock.step()) r.scoreParty();
  while (r.partyMode.phase === 'board' && clock.step());
  assert.equal(r.def.key, 'trivia'); assert.equal(r.phase, 'show'); assert.equal(r.show.mode, 'card');
  // Lobby flow + break: the intro plays in the break, the game waits in its lobby, Start goes straight in.
  const L = party(['likely', 'trivia'], { intros: 'break' }, 'lobby');
  L.r.join('Bo'); L.r.addBots(3); assert(L.r.start().ok);
  while (L.r.partyMode.phase !== 'board' && L.clock.step()) L.r.scoreParty();
  while (L.r.partyMode.phase === 'board' && L.clock.step());
  assert.equal(L.r.def.key, 'trivia'); assert.equal(L.r.phase, 'lobby');
  assert(L.r.start().ok); assert.equal(L.r.phase, 'game', 'its intro already played');
  // Old callers (no options) get the old behaviour.
  const O = party(['likely', 'trivia']); assert.equal(O.r.tvState().partyMode.intros, 'play'); assert.equal(O.r.tvState().partyMode.each, 'auto');
});

// ---------------- "How hard?" ----------------
const LEVELED = Object.keys(GAMES).filter((k) => PF.levelOf(GAMES[k]));
test('Difficulty reaches every game’s partyFit; every game with a difficulty gets the chosen level (and it leads the chips)', () => {
  // The games that have one (box/party-fit.js levelOf: a `difficulty` field, or the module's own mapping).
  for (const k of ['pizza', 'trivia', 'colormatch', 'price', 'bomb', 'emoji', 'escape', 'zombie', 'quickdraw', 'marble', 'letters', 'tune']) assert(LEVELED.includes(k), k + ' has a difficulty');
  for (const k of ['likely', 'truths', 'whosaid', 'blanks', 'memes', 'debate', 'undercover', 'alien', 'spectrum']) assert(!LEVELED.includes(k), k + ' (a social game) has none');
  for (const [k, def] of Object.entries(GAMES)) {
    const got = [];
    const hook = def.partyFit;
    def.partyFit = (ctx) => { got.push(ctx.difficulty); return hook(ctx); };
    try {
      for (const d of ['easy', 'medium', 'hard']) {
        const fit = PF.fitSettings(def, { players: 6, minutes: 10, difficulty: d });
        const L = PF.levelOf(def);
        if (L) {
          assert.equal(fit.settings[L.key], L.values[d], `${k}: ${d} → ${L.key}=${L.values[d]}`);
          assert(optionOk(def, L.key, L.values[d]), `${k}: ${L.key}=${L.values[d]} is a real option`);
          assert.equal(fit.difficulty, d); assert.equal(fit.summary[0], PF.LEVEL_LABEL[d], k + ' chip');
          assert(fit.summary.length <= 4);
        } else { assert.equal(fit.difficulty, null); assert(!fit.summary.some((s) => /Easy|Medium|Hard/.test(s) && /🟢|🟡|🔴/.test(s)), k); }
        // It starts with the fitted settings.
        const r = new BoxRoom('LVL', def, { clock: new VirtualClock(), seed: 3 }); Object.assign(r.settings, fit.settings); r.addBots(Math.max(def.min, 4));
        assert(r.start().ok, `${k} starts on ${d}`);
      }
      assert.deepEqual(got, ['easy', 'medium', 'hard'], k + ': partyFit is told the difficulty');
      // No difficulty chosen (old parties): the game's own default stays.
      const none = PF.fitSettings(def, { players: 6, minutes: 10 }), L = PF.levelOf(def);
      if (L && !(def.partyFit({ players: 6, minutes: 10 }) || {})[L.key]) assert(!(L.key in none.settings), k + ': untouched without a party difficulty');
    } finally { def.partyFit = hook; }
  }
  // Easy is really easier where it shows in the numbers.
  assert(PF.fitSettings(GAMES.letters, { players: 6, minutes: 10, difficulty: 'easy' }).settings.seconds >= PF.fitSettings(GAMES.letters, { players: 6, minutes: 10, difficulty: 'hard' }).settings.seconds);
  assert(PF.fitSettings(GAMES.trivia, { players: 6, minutes: 10, difficulty: 'easy' }).settings.seconds > PF.fitSettings(GAMES.trivia, { players: 6, minutes: 10, difficulty: 'hard' }).settings.seconds);
});

test('Party Mode: "How hard?" flows into each game; Mixed varies; bad values are ignored; the TV and phones see it', () => {
  const keys = ['pizza', 'trivia', 'colormatch', 'price', 'emoji', 'likely'];
  for (const d of ['easy', 'medium', 'hard']) {
    const { r, clock } = party(keys, { difficulty: d, intros: 'skip', each: 'quick' });
    assert.equal(r.tvState().partyMode.difficulty, d);
    r.join('Ana'); r.addBots(3);
    for (let i = 0; i < keys.length; i++) {
      const def = r.def, L = PF.levelOf(def);
      if (L) { assert.equal(r.settings[L.key], L.values[d], `${def.key} on ${d}`); assert.equal(r.tvState().partyMode.fit.difficulty, d); assert.equal(r.tvState().partyMode.fit.summary[0], PF.LEVEL_LABEL[d]); }
      else assert.equal(r.tvState().partyMode.fit.difficulty, null, def.key + ' has no difficulty');
      if (i === 0) assert(r.start().ok);
      let n = 0; while (r.phase !== 'game' && clock.step()) if (++n > 100000) break;
      if (L) assert.equal(r.game.s[L.key], L.values[d], `${def.key}: the game plays on ${d}`);
      n = 0; while (r.game.phase !== 'over' && clock.step()) if (++n > 800000) break;
      r.scoreParty();
      if (i < keys.length - 1) {
        while (r.partyMode.phase !== 'board' && clock.step());
        const up = r.tvState().partyMode.upNext; const nd = GAMES[keys[i + 1]];
        if (PF.levelOf(nd)) assert.equal(up.summary[0], PF.LEVEL_LABEL[d], 'the "Up next" chips lead with the difficulty');
        r.partyNext();
      }
    }
    if (d === 'easy') assert.equal(r.def.key, 'likely');
  }
  // Mixed: a different level from game to game (shuffled easy / medium / hard cycles), each a real level.
  const many = ['pizza', 'trivia', 'colormatch', 'price', 'emoji', 'bomb'];
  const levels = new Set();
  for (const seed of [1, 2, 3]) {
    const clock = new VirtualClock(), r = new BoxRoom('MIX', GAMES[many[0]], { clock, seed, shows: false }); r.setUnlocks(Object.keys(GAMES));
    assert(r.setParty(many.map((k) => GAMES[k]), 60, 'lobby', { difficulty: 'mixed' }).ok);
    assert.equal(r.tvState().partyMode.difficulty, 'mixed');
    const per = many.map((k) => r.partyCtx(GAMES[k]).difficulty);
    assert(per.every((x) => ['easy', 'medium', 'hard'].includes(x)), per.join());
    assert.equal(new Set(per.slice(0, 3)).size, 3, 'each cycle of three has all three levels: ' + per);
    per.forEach((x) => levels.add(x));
    const L = PF.levelOf(GAMES.pizza); assert.equal(r.settings[L.key], per[0], 'the first game is set to its level');
  }
  assert.equal(levels.size, 3);
  // Junk is ignored: each game keeps its own default.
  const { r } = party(['pizza', 'trivia'], { difficulty: 'nightmare' });
  assert.equal(r.partyMode.difficulty, null); assert.equal(r.settings.difficulty, GAMES.pizza.defaults.difficulty);
});

console.log(`\nAll ${passed} party plan tests passed.`);
