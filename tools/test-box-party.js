'use strict';
// JustGameBox party features: one room for the whole night (switch games without
// rejoining), party points across games, avatars, and the host's phone controls.
const assert = require('node:assert/strict');
const { VirtualClock } = require('../clock');
const { BoxRoom, AVATARS, REACTIONS } = require('../box/room');
const { GAMES, EXTERNAL } = require('../box');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };
function runOut(r, clock, limit = 400000) { let i = 0; while (r.game.phase !== 'over' && clock.step()) if (++i > limit) throw new Error('game never ended (' + r.game.phase + ')'); }
const newRoom = (key, seed = 3) => { const clock = new VirtualClock(); return { r: new BoxRoom('PRTY', GAMES[key], { clock, seed }), clock }; };

test('Avatars: picked on join, a default otherwise, bots get one too; only listed avatars allowed', () => {
  const { r } = newRoom('likely');
  const a = r.join('Ana', null, '🦄').player, b = r.join('Ben', null, '<script>').player;
  assert.equal(a.avatar, '🦄'); assert(AVATARS.includes(b.avatar));
  r.addBots(1); assert(AVATARS.includes(r.list().find((p) => p.bot).avatar));
  assert.equal(r.setAvatar(a, 'nope').ok, false); assert.equal(r.setAvatar(a, '🐸').ok, true); assert.equal(a.avatar, '🐸');
  assert.equal(r.tvState().players[0].avatar, '🐸');
  assert.equal(r.playerState(a).me.avatar, '🐸');
  assert(REACTIONS.length >= 6);
});

test('Switching games keeps the room code, players and avatars; only in the lobby or after a game', () => {
  const { r, clock } = newRoom('likely');
  const a = r.join('Ana', null, '🦄').player; r.addBots(4);
  const code = r.code, ids = r.list().map((p) => p.id).join();
  assert(r.switchGame(GAMES.price).ok);
  assert.equal(r.def.key, 'price'); assert.equal(r.code, code); assert.equal(r.list().map((p) => p.id).join(), ids);
  assert.equal(r.phase, 'lobby'); assert.deepEqual(r.settings, { ...GAMES.price.defaults });
  assert(r.start().ok);
  assert.equal(r.switchGame(GAMES.emoji).ok, false, 'not in the middle of a game');
  runOut(r, clock);
  assert(r.switchGame(GAMES.emoji).ok, 'after the game ends');
  assert.equal(r.tvState().game, 'emoji'); assert.equal(r.playerState(a).game, 'emoji');
  assert.equal(r.switchGame(null).ok, false);
});

test('Switching into a live-lobby big game builds its world with everyone in it', () => {
  const { r } = newRoom('likely');
  r.join('Ana'); r.addBots(3);
  assert(r.switchGame(GAMES.ducks).ok);
  assert(r.game, 'the duck valley exists in the lobby');
  assert.equal(r.tvState().live, true);
});

test('Party points: every finished game pays out by place, once; they add up across games', () => {
  const { r, clock } = newRoom('price', 11);
  r.join('Ana'); r.addBots(5);
  assert(r.start().ok); runOut(r, clock);
  r.scoreParty(); r.scoreParty(); // idempotent
  const b1 = r.partyBoard();
  assert.equal(r.played.length, 1); assert.equal(r.played[0].game, 'price');
  assert.equal(b1[0].pts, 10); assert.equal(b1[0].wins, 1);
  assert.equal(b1.reduce((a, x) => a + x.pts, 0), 10 + 7 + 5 + 4 + 3 + 2, 'six players: 10/7/5/4/3/2');
  assert(r.switchGame(GAMES.price).ok); assert(r.start().ok); runOut(r, clock); r.scoreParty();
  assert.equal(r.played.length, 2);
  assert.equal(r.partyBoard().reduce((a, x) => a + x.pts, 0), 2 * (10 + 7 + 5 + 4 + 3 + 2));
  const t = r.tvState(); assert.equal(t.played.length, 2); assert(t.party.length >= 1);
  const me = r.playerState(r.list()[0]).party; assert.equal(me.played, 2); assert(me.rank >= 1);
});

test('Play again also scores the finished game first', () => {
  const { r, clock } = newRoom('emoji', 5);
  r.join('Ana'); r.addBots(4);
  assert(r.start().ok); runOut(r, clock);
  assert(r.hostAction({ type: 'again' }).ok);
  assert.equal(r.played.length, 1);
});

test('Host phone: skip ahead and end the game mid-way; bots; only the host', () => {
  const { r } = newRoom('likely');
  const host = r.join('Ana').player, other = r.join('Ben').player;
  assert.equal(r.vipAction(host, 'bots').ok, true); assert(r.list().filter((p) => p.bot).length === 5);
  assert.equal(r.vipAction(other, 'start').ok, false);
  assert(r.vipAction(host, 'start').ok);
  assert(r.vipAction(host, 'next').ok);
  assert(r.vipAction(host, 'lobby').ok); assert.equal(r.phase, 'lobby');
  assert(r.vipAction(host, 'nobots').ok); assert.equal(r.list().filter((p) => p.bot).length, 0);
});

test('Every box game reports a finishing order at the end (results() or standings ids)', () => {
  for (const key of Object.keys(GAMES)) {
    if (key === 'kingdoms' || key === 'ducks' || key === 'funny') continue; // long games / need a TV; covered in their own tests
    const { r, clock } = newRoom(key, 9);
    r.join('Ana'); r.addBots(5);
    const s = r.start(); assert(s.ok, key + ': ' + s.error);
    runOut(r, clock); r.scoreParty();
    const pts = r.partyBoard().reduce((a, x) => a + x.pts, 0);
    assert(pts > 0, key + ' gave no party points');
  }
});

test('Game-show opening: facts from phones, the contestants are introduced, then the game starts', () => {
  const clock = new VirtualClock(), r = new BoxRoom('SHOW', GAMES.price, { clock, seed: 2, shows: true });
  const ana = r.join('Ana', null, '🦄').player; ana.sockets = 1; r.addBots(3);
  assert(r.tvState().fields.some((f) => f.key === 'showIntro'), 'a lobby setting turns it off');
  assert(r.start().ok); assert.equal(r.phase, 'show'); assert.equal(r.tvState().state, null);
  assert.equal(r.act(ana, { op: 'guess', v: 5 }).ok, false, 'no game moves during the show');
  assert.equal(r.act(ana, { op: 'fact', text: 'x' }).ok, false, 'too short');
  assert(r.act(ana, { op: 'fact', text: 'Once ate <b>soup</b> with a fork' }).ok);
  assert.equal(r.playerState(ana).show.myFact, 'Once ate bsoup/b with a fork');
  while (r.phase === 'show' && r.show.step === 'facts' && clock.step());
  const tv = r.tvState().show; assert.equal(tv.step, 'intros');
  assert.equal(tv.featured[0].name, 'Ana', 'people with facts first, humans before bots');
  assert(tv.featured.length >= 2 && tv.featured.length <= 8);
  assert(clock.now() >= 20000, 'the opening plays at least 20 seconds');
  while (r.phase === 'show' && clock.step());
  assert.equal(r.phase, 'game'); assert(r.tvState().state);
});

test('Game-show opening: the host can skip it; turning it off goes straight to the game; rules tests skip it', () => {
  const clock = new VirtualClock(), r = new BoxRoom('SHOW', GAMES.bid, { clock, seed: 2, shows: true });
  const ana = r.join('Ana').player; r.addBots(2);
  assert(r.start().ok); assert.equal(r.phase, 'show');
  assert(r.vipAction(ana, 'next').ok); assert.equal(r.show.step, 'intros');
  assert(r.vipAction(ana, 'next').ok); assert.equal(r.show.step, 'howto', 'then how to play');
  assert(r.vipAction(ana, 'next').ok); assert.equal(r.phase, 'game');
  r.resetLobby(); r.hostAction({ type: 'settings', settings: { showIntro: 'false' } });
  assert(r.start().ok); assert.equal(r.phase, 'game');
  const plain = new BoxRoom('PLN', GAMES.price, { clock: new VirtualClock() }); plain.addBots(2);
  assert(plain.start().ok); assert.equal(plain.phase, 'game');
});

test('Intro cutscene (cast mode) for the other small games: no phone step, a roll call, then the game', () => {
  const clock = new VirtualClock(), r = new BoxRoom('CAST', GAMES.likely, { clock, seed: 2, shows: true });
  const ana = r.join('Ana').player; r.addBots(3);
  assert(r.start().ok); assert.equal(r.phase, 'show');
  const tv = r.tvState().show;
  assert.equal(tv.mode, 'cast'); assert.equal(tv.step, 'intros'); assert.equal(tv.featured[0].name, 'Ana');
  assert.equal(tv.endsIn, tv.openMs + 4 * tv.perMs + tv.outroMs);
  assert.equal(r.act(ana, { op: 'fact', text: 'hello there' }).ok, false, 'no facts in cast mode');
  assert.equal(r.playerState(ana).show.mode, 'cast');
  while (r.phase === 'show' && clock.step());
  assert.equal(r.phase, 'game');
  for (const k of ['president', 'blackjack', 'blanks', 'truths', 'whosaid', 'emoji', 'likely', 'spectrum', 'sketch', 'funny']) assert.deepEqual(GAMES[k].show, { facts: false }, k);
  assert.equal(GAMES.price.show, true); assert(!GAMES.ducks.show && !GAMES.kingdoms.show);
});

test('Party Mode: a lineup plays back to back with the standings board between games, then the finale', () => {
  const clock = new VirtualClock(), r = new BoxRoom('PRTY', GAMES.likely, { clock, seed: 4 });
  assert(r.setParty([GAMES.likely, GAMES.kingdoms, GAMES.price, GAMES.emoji], 45).ok);
  const ana = r.join('Ana').player; r.addBots(4);
  assert(r.start().ok);
  let ps = r.tvState().partyMode; assert.deepEqual(ps.games, ['likely', 'kingdoms', 'price', 'emoji']); assert.equal(ps.index, 0); assert.equal(ps.phase, 'playing');
  runOut(r, clock); r.scoreParty();
  assert.equal(r.partyMode.phase, 'ending', 'the end screen stays up first');
  while (r.partyMode.phase === 'ending' && clock.step());
  assert.equal(r.partyMode.phase, 'board');
  const board = r.tvState().party; assert(board[0].gain === 10 && board.some((x) => x.prevRank === null || x.prevRank >= 1));
  while (r.partyMode.phase === 'board' && clock.step());
  assert.equal(r.def.key, 'kingdoms', 'next in the lineup'); assert.equal(r.phase, 'game');
  // The host can skip ahead: end kingdoms early via the lobby, then go on.
  assert(r.vipAction(ana, 'lobby').ok); assert.equal(r.partyMode.phase, 'playing');
  assert(r.vipAction(ana, 'partyNext').ok); assert.equal(r.def.key, 'price');
  runOut(r, clock); r.scoreParty(); while (r.partyMode.phase === 'ending' && clock.step());
  assert(r.vipAction(ana, 'partyPause').ok); const at = r.def.key;
  for (let i = 0; i < 50 && clock.step(); i++);
  assert.equal(r.def.key, at, 'paused on the board');
  assert(r.vipAction(ana, 'partyPause').ok); while (r.partyMode.phase === 'board' && clock.step());
  assert.equal(r.def.key, 'emoji');
  runOut(r, clock); r.scoreParty(); while (r.partyMode.phase === 'ending' && clock.step());
  assert.equal(r.partyMode.phase, 'done', 'the finale after the last game');
  assert.equal(r.played.length, 3);
  assert(r.vipAction(ana, 'partyAgain').ok); assert.equal(r.def.key, 'likely'); assert.equal(r.played.length, 0); assert.equal(r.partyMode.index, 0);
});

test('Party Mode: games that need more players than are here are skipped', () => {
  const clock = new VirtualClock(), r = new BoxRoom('PRTY', GAMES.price, { clock, seed: 4 });
  r.setParty([GAMES.price, GAMES.truths, GAMES.emoji], 30); // truths needs 3+
  r.join('Ana'); r.join('Ben');
  if (GAMES.truths.min <= 2) return; // nothing to skip
  assert(r.start().ok); runOut(r, clock); r.scoreParty();
  while (r.partyMode.phase !== 'board' && clock.step());
  while (r.partyMode.phase === 'board' && clock.step());
  assert.equal(r.def.key, GAMES.emoji.min <= 2 ? 'emoji' : r.def.key);
});

test('Unlockable games: locked until a whole Party Mode is finished on this TV, then they open (with a cue)', () => {
  const ZOMBIE = { key: 'zombie', name: 'Zombie Survival', min: 1, fields: [], defaults: {}, locked: { how: 'Finish a Party Mode to unlock it.' }, create: () => ({ start() {}, tv: () => ({ phase: 'x' }), view: () => ({}), act: () => ({ ok: true }) }) };
  const clock = new VirtualClock(), r = new BoxRoom('LOCK', GAMES.emoji, { clock, seed: 3 });
  r.join('Ana'); r.addBots(3);
  assert.equal(r.switchGame(ZOMBIE).ok, false, 'locked at first');
  assert(r.setParty([GAMES.emoji, ZOMBIE], 30).ok); assert.deepEqual(r.partyMode.defs.map((d) => d.key), ['emoji'], 'locked games are left out of a lineup');
  assert(r.start().ok); runOut(r, clock); r.scoreParty();
  assert(!r.unlocks.has('zombie'), 'one game is not enough');
  while (r.partyMode.phase !== 'done' && clock.step());
  assert(r.unlocks.has('zombie'), 'the party finale unlocks it'); assert(r.fxLog.some((f) => f.kind === 'unlock' && f.key === 'zombie'));
  assert(r.tvState().unlocks.includes('zombie')); // (Emoji Charades also opens Color Match)
  assert(r.switchGame(ZOMBIE).ok, 'open now');
  const r2 = new BoxRoom('LCK2', GAMES.emoji, { clock: new VirtualClock() }); r2.setUnlocks(['zombie', 'nope', 42]);
  assert.deepEqual([...r2.unlocks], ['zombie'], 'a TV brings the unlocks it remembers (only real ones)');
});

// ---- games played elsewhere (JustMafia) ----
const handoff = (r, log = []) => { let n = 0; r.onExternal = (def) => { log.push(def.key); return { ok: true, code: 'MAF' + (++n), hostKey: 'k' + n }; }; return log; };

test('Switching to JustMafia hands the room over: TV and phones get where to go, the room waits', () => {
  const { r } = newRoom('likely');
  const a = r.join('Ana', null, '🦄').player; r.join('Bo Peep'); r.addBots(3);
  assert.equal(r.switchGame(EXTERNAL.mafia).ok, false, 'no bridge: says so');
  const log = handoff(r);
  const sw = r.switchGame(EXTERNAL.mafia);
  assert(sw.ok && sw.external); assert.deepEqual(log, ['mafia']);
  assert.equal(r.def.key, 'likely', 'the box room keeps its own game'); assert.equal(r.phase, 'lobby');
  assert.deepEqual(r.tvState().away, { game: 'mafia', title: 'JustMafia', code: 'MAF1', hostKey: 'k1', at: r.now() });
  const pa = r.playerState(a).away; assert.equal(pa.code, 'MAF1');
  assert.equal(pa.url, '/play?room=MAF1&autojoin=1&name=Ana');
  assert.equal(r.playerState(r.list()[1]).away.url, '/play?room=MAF1&autojoin=1&name=Bo%20Peep');
  assert(!JSON.stringify(r.playerState(a)).includes('k1'), 'phones never see the TV key');
  assert(r.externalBack().ok); assert.equal(r.tvState().away, null);
});

test('externalResult: party points best first (10/7/5…, everyone else 1), played list, once per call', () => {
  const { r } = newRoom('likely');
  const [a, b, c] = ['Ana', 'Ben', 'Cy'].map((n) => r.join(n).player); r.addBots(5);
  handoff(r); assert(r.switchGame(EXTERNAL.mafia).ok);
  const res = r.externalResult('mafia', 'JustMafia', [c.id, a.id, 'ghost', c.id, ...r.list().filter((p) => p.bot).map((p) => p.id), b.id]);
  assert(res.ok); assert.equal(res.awarded, 8, 'unknown ids and repeats are ignored');
  const pts = Object.fromEntries(r.partyBoard().map((x) => [x.name, x.pts]));
  assert.equal(pts.Cy, 10); assert.equal(pts.Ana, 7); assert.equal(pts.Ben, 1);
  assert.equal(r.partyBoard()[0].wins, 1);
  assert.deepEqual(r.played.at(-1), { game: 'mafia', title: 'JustMafia', winner: 'Cy' });
  assert.equal(r.away, null, 'the room is back');
  assert.equal(r.partyRow(c.id).games, 1);
  assert(r.fxLog.some((f) => f.kind === 'back'));
});

test('Party Mode with JustMafia as the finale: hand over, come back with points, then the finale', () => {
  const clock = new VirtualClock(), r = new BoxRoom('PRTY', GAMES.likely, { clock, seed: 5 });
  const log = handoff(r);
  assert(r.setParty([GAMES.likely, EXTERNAL.mafia], 60).ok);
  assert.deepEqual(r.partyState().games, ['likely', 'mafia']);
  const ana = r.join('Ana').player; r.addBots(5);
  assert(r.start().ok);
  while (r.phase === 'show' && clock.step());
  runOut(r, clock); r.scoreParty();
  assert.equal(r.played.length, 1);
  while (r.partyMode.phase !== 'board' && clock.step());
  assert.equal(r.partyState().next, 'mafia');
  while (r.partyMode.phase === 'board' && clock.step());
  assert.deepEqual(log, ['mafia'], 'the lineup handed over to JustMafia');
  assert.equal(r.partyMode.index, 1); assert.equal(r.partyMode.phase, 'playing');
  assert.equal(r.tvState().away.game, 'mafia'); assert(r.playerState(ana).away.url.startsWith('/play?room=MAF1'));
  // Nothing moves on while the party is away.
  for (let i = 0; i < 50; i++) clock.step();
  assert.equal(r.partyMode.phase, 'playing');
  const before = r.partyRow(ana.id).pts;
  r.externalResult('mafia', 'JustMafia', [ana.id]);
  assert.equal(r.partyRow(ana.id).pts, before + 10);
  assert.equal(r.partyState().ext, true, 'the TV shows the board even though the room sits in a lobby');
  while (r.partyMode.phase !== 'done' && clock.step());
  assert.equal(r.partyMode.phase, 'done', 'mafia was last: the finale');
  assert.equal(r.played.length, 2); assert.equal(r.played[1].game, 'mafia');
  assert(r.unlocks.has('zombie'), 'a finished party unlocks as usual');
});

test('Party Mode: JustMafia in the middle goes on to the next game; coming back early skips it; too few players skips it', () => {
  const clock = new VirtualClock(), r = new BoxRoom('PRTY', GAMES.likely, { clock, seed: 6 });
  handoff(r);
  r.setParty([GAMES.likely, EXTERNAL.mafia, GAMES.price], 60);
  r.join('Ana'); r.addBots(5);
  r.start(); while (r.phase === 'show' && clock.step()); runOut(r, clock); r.scoreParty();
  while (!r.away && clock.step());
  assert(r.away, 'away to JustMafia');
  assert(r.externalBack().ok);
  assert.equal(r.played.length, 1, 'no result, no points');
  while (r.partyMode.phase !== 'board' && clock.step());
  assert.equal(r.partyState().next, 'price');
  while (r.partyMode.phase === 'board' && clock.step());
  assert.equal(r.def.key, 'price'); assert.notEqual(r.phase, 'lobby', 'the next game started');
  assert.equal(r.partyState().ext, false);
  // 'Between games: lobby' flow: back from JustMafia, the next game waits in its lobby.
  const r3 = new BoxRoom('PRT3', GAMES.likely, { clock, seed: 8 }); handoff(r3);
  r3.setParty([GAMES.likely, EXTERNAL.mafia, GAMES.price], 60, 'lobby'); const cy = r3.join('Cy').player; r3.addBots(5);
  r3.start(); while (r3.phase === 'show' && clock.step()); runOut(r3, clock); r3.scoreParty();
  while (!r3.away && r3.partyMode.phase !== 'done' && clock.step()) if (r3.partyMode.phase === 'board' && r3.partyMode.flow === 'lobby' && r3.def.key === 'likely') r3.partyNext();
  assert(r3.away, 'away to JustMafia in lobby flow too');
  r3.externalResult('mafia', 'JustMafia', [cy.id]);
  while (r3.partyMode.phase !== 'board' && clock.step());
  r3.partyNext();
  assert.equal(r3.def.key, 'price'); assert.equal(r3.phase, 'lobby', 'waits in the lobby');
  const r2 = new BoxRoom('PRT2', GAMES.likely, { clock, seed: 7 }); const log2 = handoff(r2);
  r2.setParty([GAMES.likely, EXTERNAL.mafia], 60); r2.join('Ana'); r2.addBots(2);
  r2.start(); while (r2.phase === 'show' && clock.step()); runOut(r2, clock); r2.scoreParty();
  while (r2.partyMode.phase !== 'done' && clock.step());
  assert.deepEqual(log2, [], 'skipped');
});

test('Party Mode "let the host adjust": the next game waits in its lobby for Start; "keep it flowing" is the default', () => {
  const clock = new VirtualClock(), r = new BoxRoom('PRTY', GAMES.likely, { clock, seed: 4 });
  assert(r.setParty([GAMES.likely, GAMES.emoji], 30, 'lobby').ok); assert.equal(r.partyState().flow, 'lobby');
  const ana = r.join('Ana').player; r.addBots(4);
  assert(r.start().ok); runOut(r, clock); r.scoreParty();
  for (let i = 0; i < 1000 && r.def.key !== 'emoji'; i++) if (!clock.step()) break;
  assert.equal(r.def.key, 'emoji'); assert.equal(r.phase, 'lobby', 'waits for the host');
  assert(r.vipAction(ana, 'start').ok); assert.equal(r.phase, 'game');
  const auto = new BoxRoom('AUTO', GAMES.likely, { clock: new VirtualClock() }); auto.setParty([GAMES.likely], 30);
  assert.equal(auto.partyState().flow, 'auto');
});

test('How to play: after the intro every game teaches its rules; "Got it" from everyone moves on early', () => {
  const clock = new VirtualClock(), r = new BoxRoom('HOW', GAMES.likely, { clock, seed: 3, shows: true });
  const ana = r.join('Ana').player, ben = r.join('Ben').player; ana.sockets = 1; ben.sockets = 1; r.addBots(2);
  assert(r.start().ok);
  while (r.phase === 'show' && r.show.step === 'intros' && clock.step());
  assert.equal(r.show.step, 'howto');
  const tv = r.tvState().show; assert(tv.howMs >= 5 * tv.howStepMs, 'about 7–8 s a step'); assert.equal(tv.ready, 0); assert.equal(tv.readyOf, 2);
  assert.equal(r.playerState(ana).show.step, 'howto');
  assert.equal(r.act(ana, { op: 'guess' }).ok, false, 'no game moves yet');
  r.show.stepAt -= 7000; // as if the first step has played
  assert(r.act(ana, { op: 'gotit' }).ok); assert.equal(r.playerState(ana).show.gotIt, true); assert.equal(r.phase, 'show', 'still waiting for Ben');
  assert(r.act(ben, { op: 'gotit' }).ok);
  const t0 = r.now(); while (r.phase === 'show' && clock.step());
  assert.equal(r.phase, 'game'); assert(r.now() - t0 <= 2000, 'starts right after everyone has it');
});

console.log(`\nAll ${passed} party tests passed.`);
