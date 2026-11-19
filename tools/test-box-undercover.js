'use strict';
// JustUndercover rules: roles and secrecy, every mode played to the end by bots on a virtual
// clock, input validation, forgiving password guesses, disconnects, and scoring.
//   node tools/test-box-undercover.js
const assert = require('node:assert/strict');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/undercover');
const PF = require('../box/party-fit');
const T = def._test;
let passed = 0;
const test = (n, fn) => { fn(); passed++; console.log('  ✓ ' + n); };
const run = (room, clock, until = () => room.game.phase === 'over', max = 300000) => { let i = 0; while (!until() && clock.step()) if (++i > max) throw new Error('never got there'); };
function make(n, settings = {}, { humans = 0, seed = 3 } = {}) {
  const clock = new VirtualClock(), room = new BoxRoom('UC', def, { clock, seed });
  const hs = []; for (let i = 0; i < humans; i++) { const p = room.join('Hum' + i).player; p.sockets = 1; hs.push(p); }
  room.addBots(n - humans);
  Object.assign(room.settings, settings);
  assert(room.start().ok);
  return { clock, room, g: room.game, hs };
}
const adv = (clock, ms) => { let done = false; clock.set(() => { done = true; }, ms); while (!done && clock.step()); };
const quoted = (json, w) => w && json.toLowerCase().includes(JSON.stringify(String(w).toLowerCase()));

test('word lists: 12+ files, 40+ similar pairs each, every word has 2 one-word hints that never contain it', () => {
  const cats = Object.values(T.CATS); assert(cats.length >= 12);
  for (const c of cats) {
    assert(c.pairs.length >= 40, c.key + ' has ' + c.pairs.length);
    for (const p of c.pairs) {
      assert(p.a && p.b && p.a !== p.b, c.key + ' pair');
      for (const [w, hs] of [[p.a, p.ah], [p.b, p.bh]]) { assert(hs.length >= 2, w + ' hints'); for (const h of hs) { assert(!/\s/.test(h)); assert(!T.givesAway(h, w), h + ' gives away ' + w); } }
    }
    for (const h of c.generic) assert(!/\s/.test(h));
  }
});

test('every mode plays to the end with bots (3, 6, 12 players); results() lists everyone best-first', () => {
  for (const mode of ['words', 'sketch', 'mixed', 'blank', 'double', 'rival', 'speed', 'picture']) for (const n of [3, 6, 12]) {
    const { clock, room, g } = make(n, { mode, rounds: 2 }, { seed: n + mode.length });
    run(room, clock);
    const r = g.results(); assert.equal(r.length, n, mode + ' ' + n);
    const st = g.standings(); for (let i = 1; i < st.length; i++) assert(st[i - 1].points >= st[i].points);
    assert.equal(g.history.length, 2, mode + ': two cases played');
    assert(g.final && Array.isArray(g.final.awards));
  }
});

test('mixed alternates word modes and Sketch Line', () => {
  const { clock, room, g } = make(6, { mode: 'mixed', rounds: 4 });
  run(room, clock);
  const kinds = g.history.map((h) => T.MODES[h.mode].kind);
  assert.deepEqual(kinds.map((k) => k === 'sketch'), [false, true, false, true], kinds.join());
});

test('role assignment: impostor count by mode and players; blank and faker get no word; the mole gets the pair’s other word', () => {
  const count = (mode, n, moles = 'auto') => { const { g } = make(n, { mode, moles }); return [...g.c.roles.values()].filter((r) => r.mole).length; };
  assert.equal(count('words', 3), 1); assert.equal(count('words', 6), 1); assert.equal(count('words', 8), 2); assert.equal(count('words', 14), 3);
  assert.equal(count('double', 6), 2, 'double agents: two'); assert.equal(count('double', 4), 1, 'too few for two');
  assert.equal(count('words', 9, 3), 3); assert.equal(count('words', 5, 3), 1, 'capped so agents outnumber');
  assert.equal(count('sketch', 6), 1); assert.equal(count('sketch', 12), 2);
  assert.equal(count('rival', 8), 0);
  for (let seed = 1; seed < 8; seed++) {
    const { g } = make(6, { mode: 'words' }, { seed }); const c = g.c, words = new Set([c.pair.a, c.pair.b]);
    for (const r of c.roles.values()) { assert(words.has(r.word)); assert.equal(r.word === c.agentWord, !r.mole); }
    assert.notEqual(c.agentWord, c.moleWord);
  }
  { const { g } = make(6, { mode: 'blank' }); for (const r of g.c.roles.values()) assert.equal(r.word == null, r.mole); }
  { const { g } = make(6, { mode: 'sketch' }); for (const r of g.c.roles.values()) assert.equal(r.word == null, r.mole); }
  { const { g } = make(7, { mode: 'rival' }); const t = [...g.c.roles.values()].map((r) => r.team); assert.equal(t.filter((x) => x === 'a').length, 3); assert.equal(t.filter((x) => x === 'b').length, 4);
    for (const r of g.c.roles.values()) assert.equal(r.word, r.team === 'a' ? g.c.pair.a : g.c.pair.b); }
});

test('secrecy: no password or role reaches the TV, and no phone sees anyone else’s word, until the case is revealed', () => {
  for (const mode of ['words', 'sketch', 'blank', 'double', 'rival', 'picture', 'speed']) {
    const { clock, room, g, hs } = make(7, { mode, rounds: 2 }, { humans: 2, seed: 11 });
    let checked = 0, revealed = 0;
    for (let i = 0; i < 400000 && g.phase !== 'over'; i++) {
      // Humans play along: whoever's turn it is gives a harmless clue / line / doodle, votes, picks.
      for (const p of hs) {
        const v = g.view(p);
        if (v.myTurn) { if (v.c.kind === 'sketch') room.act(p, { op: 'line', stroke: { p: [100, 100, 900, 900] } }); else if (v.c.picture) room.act(p, { op: 'doodle', strokes: [{ p: [10, 10, 50, 50] }] }); else room.act(p, { op: 'clue', text: 'zzq' + i }); }
        if (g.phase === 'vote' && !v.myVote && !v.out) { const t = v.c.cards.find((x) => x.id !== p.id && !x.out); if (t) room.act(p, { op: 'vote', target: t.id }); }
        if (g.phase === 'pick' && !v.myPicks) { const t = v.c.cards.find((x) => x.id !== p.id); room.act(p, { op: 'pick', ids: [t.id] }); }
        if (v.guessing && !v.guessing.done) room.act(p, { op: 'guess', text: 'nothing' });
        if (g.phase === 'talk') room.act(p, { op: 'ready' });
      }
      const c = g.c;
      if (c && g.phase !== 'case' && g.phase !== 'over') {
        // A caught faker's / blank agent's guess is read out on purpose (it decides the case).
        const tv = JSON.stringify(room.tvState()).replace(/"guess":{[^}]*}/g, '');
        const words = [c.agentWord, c.moleWord, c.pair.a, c.pair.b];
        for (const w of words) assert(!quoted(tv, w), `${mode}: the TV shows "${w}" in ${g.phase}`);
        assert(!/"role":/.test(tv) && !/"word":/.test(tv) && !/"team":/.test(tv), mode + ': roles hidden on the TV');
        for (const p of hs) {
          const r = c.roles.get(p.id), pv = JSON.stringify(room.playerState(p)).replace(/"guess":{[^}]*}/g, '');
          for (const w of words) if (w !== r.word) assert(!quoted(pv, w), `${mode}: ${p.name} sees another word "${w}"`);
          // In Word Clues, nobody is told which side they are on (until caught).
          if (c.kind === 'words' && !T.MODES[mode].blank && !r.out) assert(!/"outRole":"mole"/.test(pv.replace(/"cards".*$/, '')), 'role not on the phone');
        }
        checked++;
      }
      if (g.phase === 'case') { const tv = room.tvState().state; assert(tv.c.words && tv.c.cards.every((x) => x.role)); revealed++; }
      if (!clock.step()) break;
    }
    assert.equal(g.phase, 'over', mode + ' finished'); assert(checked > 20); assert(revealed > 0);
  }
});

test('clue validation: your turn only, one word, not your password (or near it), not a repeat', () => {
  const { clock, room, g, hs } = make(4, { mode: 'words' }, { humans: 4 });
  run(room, clock, () => g.phase === 'clue');
  const turn = hs.find((p) => g.c.turnId === p.id), other = hs.find((p) => p !== turn), w = g.c.roles.get(turn.id).word;
  assert.equal(room.act(other, { op: 'clue', text: 'hello' }).ok, false, 'not your turn');
  for (const bad of [{ op: 'clue' }, { op: 'clue', text: '' }, { op: 'clue', text: 'two words' }, { op: 'clue', text: 'x'.repeat(30) }, { op: 'clue', text: '<b>' }, { op: 'clue', text: { a: 1 } }, { op: 'clue', text: w }, { op: 'clue', text: w.toUpperCase() + 's' }, { op: 'line', stroke: { p: [1, 2, 3, 4] } }, { op: 'nope' }, {}]) {
    assert.equal(room.act(turn, bad).ok, false, JSON.stringify(bad));
  }
  assert(T.givesAway('beaches', 'beach') && T.givesAway('Ice', 'ice cream') === false && T.givesAway('cream', 'ice cream') && T.givesAway('sunflowers', 'sunflower') && T.givesAway('piza', 'pizza'));
  assert(!T.givesAway('sand', 'beach') && !T.givesAway('cat', 'car'));
  assert(room.act(turn, { op: 'clue', text: 'Mysterious' }).ok);
  adv(clock, 1000);
  const next = hs.find((p) => g.c.turnId === p.id);
  assert.equal(room.act(next, { op: 'clue', text: 'mysterious' }).ok, false, 'already said');
  assert(room.act(next, { op: 'clue', text: "rock-n'roll" }).ok, 'hyphens and apostrophes are fine');
});

test('drawing validation: one line on your turn (0..1000), doodles capped', () => {
  const { clock, room, g, hs } = make(4, { mode: 'sketch' }, { humans: 4 });
  run(room, clock, () => g.phase === 'clue' && !!g.c.turnId);
  const turn = hs.find((p) => g.c.turnId === p.id), other = hs.find((p) => p !== turn);
  assert.equal(room.act(other, { op: 'line', stroke: { p: [1, 1, 2, 2] } }).ok, false);
  for (const s of [null, { p: [] }, { p: [1, 2, 3] }, { p: [1, 2, 3, 1001] }, { p: [1.5, 2, 3, 4] }, { p: Array(1000).fill(5) }, { p: 'abc' }]) assert.equal(room.act(turn, { op: 'line', stroke: s }).ok, false, JSON.stringify(s));
  assert.equal(room.act(turn, { op: 'clue', text: 'cheat' }).ok, false, 'draw, don’t type');
  assert(room.act(turn, { op: 'line', stroke: { p: [100, 100, 500, 520, 800, 300] } }).ok);
  assert.equal(g.c.strokes.length, 1); assert.equal(g.c.strokes[0].color, turn.color);
  assert.equal(room.act(turn, { op: 'line', stroke: { p: [1, 1, 2, 2] } }).ok, false, 'one line a turn');
  assert(T.cleanDoodle([{ p: [1, 1, 5, 5] }]) && !T.cleanDoodle([]) && !T.cleanDoodle(Array(20).fill({ p: [1, 1, 2, 2] })) && !T.cleanDoodle([{ p: Array(1600).fill(3) }]));
});

test('the mole’s guess is forgiving (case, spaces, plurals, "the", small typos) but not too forgiving', () => {
  const ok = [['Beach', 'beach'], ['the beach', 'beach'], ['beaches', 'beach'], ['  BEACH!! ', 'beach'], ['icecream', 'ice cream'], ['Ice-Cream', 'ice cream'], ['piza', 'pizza'], ['spagetti', 'spaghetti'], ['café', 'cafe'], ['hot dogs', 'hot dog'], ['rollercoaster', 'roller coaster']];
  const no = [['pool', 'beach'], ['car', 'cat'], ['', 'beach'], ['bea', 'beach'], ['pie', 'pizza'], ['muffin', 'cupcake']];
  for (const [a, b] of ok) assert(T.sameWord(a, b), a + ' ~ ' + b);
  for (const [a, b] of no) assert(!T.sameWord(a, b), a + ' !~ ' + b);
});

test('votes: alive players only, not yourself, not out of phase', () => {
  const { clock, room, g, hs } = make(5, { mode: 'words', talk: 30 }, { humans: 5 });
  run(room, clock, () => g.phase === 'clue');
  assert.equal(room.act(hs[0], { op: 'vote', target: hs[1].id }).ok, false, 'not voting yet');
  run(room, clock, () => g.phase === 'talk');
  for (const p of hs) room.act(p, { op: 'ready' });
  run(room, clock, () => g.phase === 'vote');
  assert.equal(room.act(hs[0], { op: 'vote', target: hs[0].id }).ok, false, 'self');
  assert.equal(room.act(hs[0], { op: 'vote', target: 'p999' }).ok, false, 'nobody');
  assert(room.act(hs[0], { op: 'vote', target: hs[1].id }).ok);
  assert(room.act(hs[0], { op: 'vote', target: hs[2].id }).ok, 'can change your mind');
  assert.equal(g.c.votes.get(hs[0].id), hs[2].id);
});

// Play one interrogation where every human votes for `target` and returns the eject.
function voteOut(room, clock, g, hs, target) {
  run(room, clock, () => g.phase === 'clue');
  let k = 0;
  while (g.phase === 'clue') { const p = hs.find((x) => x.id === g.c.turnId); if (p) room.act(p, g.c.kind === 'sketch' ? { op: 'line', stroke: { p: [100 + k, 100, 200, 300] } } : { op: 'clue', text: 'clue' + 'abcdefghijklmnopqrstuvwxyz'[k++ % 26] + k }); adv(clock, 800); }
  run(room, clock, () => g.phase === 'talk');
  for (const p of hs) room.act(p, { op: 'ready' });
  run(room, clock, () => g.phase === 'vote');
  for (const p of hs) if (!g.c.roles.get(p.id).out) room.act(p, { op: 'vote', target: p.id === target ? hs.find((x) => x.id !== target && !g.c.roles.get(x.id).out).id : target });
  run(room, clock, () => g.phase === 'eject' || g.phase === 'guess');
  return g.c.eject;
}

test('scoring, Word Clues: catching the mole pays the agents; the mole is paid for each interrogation survived', () => {
  const { clock, room, g, hs } = make(5, { mode: 'words', rounds: 1 }, { humans: 5, seed: 4 });
  run(room, clock, () => g.phase === 'brief');
  const mole = hs.find((p) => g.c.roles.get(p.id).mole), agents = hs.filter((p) => p !== mole);
  const innocent = agents[0];
  // Interrogation 1: the room ejects an innocent agent (the mole survives: +75).
  const e1 = voteOut(room, clock, g, hs, innocent.id); assert.equal(e1.mole, false); assert.equal(e1.id, innocent.id);
  assert.equal(g.points.get(mole.id), T.PTS.cycle);
  run(room, clock, () => g.phase === 'clue');
  assert.equal(g.c.cycle, 2, 'another interrogation');
  // Interrogation 2: caught (votes on the mole +50 each), then a wrong guess, then the agents win.
  const e2 = voteOut(room, clock, g, hs.filter((p) => p !== innocent), mole.id); assert.equal(e2.mole, true);
  run(room, clock, () => g.phase === 'guess');
  assert.equal(room.act(agents[1], { op: 'guess', text: 'x' }).ok, false, 'only the caught mole guesses');
  assert(room.act(mole, { op: 'guess', text: 'definitely not it' }).ok);
  run(room, clock, () => g.phase === 'case');
  assert.equal(g.c.result.winner, 'agents');
  for (const a of agents.slice(1)) assert.equal(g.points.get(a.id), T.PTS.vote + T.PTS.agentsWin, a.name);
  assert.equal(g.points.get(innocent.id), T.PTS.agentOut, 'the ejected agent still shares the win');
  assert.equal(g.points.get(mole.id), T.PTS.cycle);
  run(room, clock);
  assert.equal(g.results()[g.results().length - 1], mole.id);
});

test('scoring, Sketch Line: a caught faker who names the word wins anyway; a tie lets the faker escape', () => {
  { const { clock, room, g, hs } = make(4, { mode: 'sketch', rounds: 1 }, { humans: 4, seed: 9 });
    run(room, clock, () => g.phase === 'brief');
    const faker = hs.find((p) => g.c.roles.get(p.id).mole), word = g.c.agentWord;
    assert.equal(g.view(faker).card.word, null); assert(g.view(faker).card.faker); assert.equal(g.view(hs.find((p) => p !== faker)).card.word, word);
    const e = voteOut(room, clock, g, hs, faker.id); assert(e.mole);
    run(room, clock, () => g.phase === 'guess');
    assert(room.act(faker, { op: 'guess', text: ' The ' + word.toUpperCase() + 's' }).ok);
    run(room, clock, () => g.phase === 'case');
    assert.equal(g.c.result.winner, 'moles'); assert.equal(g.c.result.why, 'cracked');
    assert.equal(g.points.get(faker.id), T.PTS.molesWin);
    for (const p of hs) if (p !== faker) assert.equal(g.points.get(p.id), T.PTS.vote);
  }
  { const { clock, room, g, hs } = make(4, { mode: 'sketch', rounds: 1 }, { humans: 4, seed: 2 });
    run(room, clock, () => g.phase === 'vote' || (g.phase === 'clue' && !!g.c.turnId));
    while (g.phase === 'clue') { const p = hs.find((x) => x.id === g.c.turnId); if (p) room.act(p, { op: 'line', stroke: { p: [1, 1, 9, 9] } }); adv(clock, 800); }
    run(room, clock, () => g.phase === 'talk'); for (const p of hs) room.act(p, { op: 'ready' });
    run(room, clock, () => g.phase === 'vote');
    room.act(hs[0], { op: 'vote', target: hs[1].id }); room.act(hs[1], { op: 'vote', target: hs[0].id }); room.act(hs[2], { op: 'vote', target: hs[3].id }); room.act(hs[3], { op: 'vote', target: hs[2].id });
    run(room, clock, () => g.phase === 'case');
    assert.equal(g.c.result.winner, 'moles'); assert.equal(g.c.result.why, 'tie');
  }
});

test('scoring, Blank Agent: a caught blank agent who names the password wins the case', () => {
  const { clock, room, g, hs } = make(5, { mode: 'blank', rounds: 1 }, { humans: 5, seed: 6 });
  run(room, clock, () => g.phase === 'brief');
  const blank = hs.find((p) => g.c.roles.get(p.id).mole); assert(g.view(blank).card.blank && g.view(blank).card.noWord);
  voteOut(room, clock, g, hs, blank.id);
  run(room, clock, () => g.phase === 'guess');
  assert(room.act(blank, { op: 'guess', text: g.c.agentWord }).ok);
  run(room, clock, () => g.phase === 'case');
  assert.equal(g.c.result.winner, 'moles'); assert(g.points.get(blank.id) >= T.PTS.molesWin);
});

test('scoring, Rival Words: points for each teammate found, a penalty for each rival picked', () => {
  const { clock, room, g, hs } = make(4, { mode: 'rival', rounds: 1 }, { humans: 4, seed: 5 });
  run(room, clock, () => g.phase === 'brief');
  const team = (p) => g.c.roles.get(p.id).team;
  run(room, clock, () => g.phase !== 'brief');
  let k = 0;
  while (g.phase === 'clue') { const p = hs.find((x) => x.id === g.c.turnId); if (p) room.act(p, { op: 'clue', text: 'word' + 'abcdefghij'[k++ % 10] + k }); adv(clock, 800); }
  run(room, clock, () => g.phase === 'talk'); for (const p of hs) room.act(p, { op: 'ready' });
  run(room, clock, () => g.phase === 'pick');
  assert.equal(room.act(hs[0], { op: 'pick', ids: [] }).ok, false); assert.equal(room.act(hs[0], { op: 'pick', ids: [hs[0].id] }).ok, false); assert.equal(room.act(hs[0], { op: 'pick', ids: 'x' }).ok, false);
  for (const p of hs) { const mate = hs.find((x) => x !== p && team(x) === team(p)), rival = hs.find((x) => team(x) !== team(p)); room.act(p, { op: 'pick', ids: p === hs[0] ? [mate.id, rival.id] : [mate.id] }); }
  run(room, clock, () => g.phase === 'case');
  const mate0 = hs.find((x) => x !== hs[0] && team(x) === team(hs[0]));
  assert.equal(g.points.get(hs[0].id), T.PTS.teamRight - T.PTS.teamWrong + T.PTS.found);
  assert.equal(g.points.get(mate0.id), T.PTS.teamRight + T.PTS.found);
  assert.equal(g.c.result.winner, 'rival'); assert(room.tvState().state.c.words.a);
});

test('disconnects: an away player’s turn is skipped; votes don’t wait; reconnecting shows the same card', () => {
  const { clock, room, g, hs } = make(5, { mode: 'words', clue: 40 }, { humans: 2, seed: 8 });
  run(room, clock, () => g.phase === 'brief');
  const [a] = hs, word = g.view(a).card.word;
  a.sockets = 0;
  run(room, clock, () => g.phase === 'clue' && g.c.turnId === a.id || g.phase === 'talk');
  if (g.c.turnId === a.id) { const t0 = clock.now(); run(room, clock, () => g.c.turnId !== a.id); assert(clock.now() - t0 < 5000, 'skipped quickly, not after 40 s'); }
  run(room, clock, () => g.phase === 'vote');
  const t0 = clock.now(); hs[1].sockets === 1 && room.act(hs[1], { op: 'vote', target: g.c.order.find((id) => id !== hs[1].id && !g.c.roles.get(id).out) });
  run(room, clock, () => g.phase !== 'vote'); assert(clock.now() - t0 < 20000, 'the vote closed without the away player');
  a.sockets = 1;
  const v = room.playerState(a).state; assert.equal(v.card.word, word, 'same card after reconnecting');
  run(room, clock); assert.equal(g.phase, 'over');
});

test('late joiners watch this case and get a card in the next; kicked players are handled', () => {
  const { clock, room, g } = make(5, { mode: 'words', rounds: 2 }, { seed: 12 });
  run(room, clock, () => g.phase === 'clue');
  const late = room.join('Late').player; late.sockets = 1;
  assert(room.playerState(late).state.spectator); assert.equal(room.act(late, { op: 'clue', text: 'hi' }).ok, false);
  run(room, clock, () => g.caseNo === 2 && g.phase === 'brief');
  assert(g.view(late).card, 'a card in the next case');
  const someone = room.list().find((p) => p.bot && g.c.roles.get(p.id));
  room.kick(someone.id);
  run(room, clock); assert.equal(g.phase, 'over'); assert(!g.results().includes(someone.id));
});

test('host Next skips every phase; partyFit fits the crowd and the time', () => {
  const { room, g } = make(6, { mode: 'mixed', rounds: 2 });
  for (let i = 0; i < 200 && g.phase !== 'over'; i++) room.hostAction({ type: 'next' });
  assert.equal(g.phase, 'over');
  let prev = 0;
  for (const minutes of [5, 10, 20, 30]) {
    const f = def.partyFit({ players: 6, minutes }); const fit = PF.fitSettings(def, { players: 6, minutes });
    assert.equal(fit.summary.length >= 2, true); assert(def.fields.find((x) => x.key === 'rounds').options.some((o) => o.value === f.rounds));
    const est = T.estimate({ ...def.defaults, ...f }, 6); assert(est >= prev - 0.5, 'longer plans, longer games'); prev = est;
    assert(Math.abs(est - minutes) < Math.max(4, minutes * 0.35), `${minutes} min plan → ${est.toFixed(1)} min`);
  }
});

console.log(`\n${passed} JustUndercover tests passed.`);
