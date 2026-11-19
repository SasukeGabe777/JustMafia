'use strict';
// JustGameBox lifetime profiles: the store (box/profiles.js), results recorded from a room's
// scoreParty, trophies and titles, name + password sign-in (old PINs too), file persistence, and rooms without
// profiles working exactly as before. Also the end-of-night recap data (box/recap.js).
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const { BoxProfileStore, TROPHIES, GUESSING } = require('../box/profiles');
const { GAMES } = require('../box');
const { buildRecap, personalRecap } = require('../box/recap');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };
function runOut(r, clock, limit = 400000) { let i = 0; while (r.game.phase !== 'over' && clock.step()) if (++i > limit) throw new Error('game never ended'); }

test('Store: create, authenticate with the token only, never stores the token', () => {
  const st = new BoxProfileStore(null), a = st.create('Ana');
  assert.match(a.token, /^[a-f0-9]{64}$/);
  assert(st.authenticate(a)); assert(!st.authenticate({ id: a.id, token: 'f'.repeat(64) })); assert(!st.authenticate({ id: '__proto__', token: a.token })); assert(!st.authenticate(null));
  assert(!JSON.stringify(st.data).includes(a.token), 'only a verifier is kept');
  const v = st.view(a.id);
  assert.equal(v.name, 'Ana'); assert.equal(v.stats.games, 0); assert.equal(v.trophies.length, TROPHIES.length); assert(v.trophies.every((t) => !t.earned));
});

test('Store: games, wins, party points, nights and trophies; titles only from earned trophies', () => {
  const st = new BoxProfileStore(null), a = st.create('Ana');
  let news = st.recordGame(a.id, { game: 'price', place: 1, of: 4, pts: 10, room: 'R1' });
  assert(news.some((t) => t.id === 'firstWin') && news.some((t) => t.id === 'firstGame'));
  st.recordGame(a.id, { game: 'emoji', place: 3, of: 4, pts: 5, room: 'R1' });
  st.recordGame(a.id, { game: 'zombie', place: 2, of: 4, pts: 7, survived: true, room: 'R2' });
  const v = st.view(a.id);
  assert.equal(v.stats.games, 3); assert.equal(v.stats.wins, 1); assert.equal(v.stats.partyPts, 22); assert.equal(v.stats.nights, 2); assert.equal(v.stats.podiums, 3); assert.equal(v.stats.bestPlace, 1);
  assert.equal(v.stats.byGame.find((g) => g.game === 'price').won, 1);
  assert(v.trophies.find((t) => t.id === 'survivor').earned, 'survived Zombie Survival');
  assert.equal(v.nights.length, 2); assert.equal(v.nights[1].games, 2, 'night R1 had two games');
  assert.equal(st.setTitle(a.id, 'partyWin3').ok, false, 'not earned');
  assert(st.setTitle(a.id, 'survivor').ok); assert.equal(st.titleOf(a.id), 'the Survivor');
  assert(st.setTitle(a.id, null).ok); assert.equal(st.titleOf(a.id), null);
});

test('Trophies: a first win in every guessing game; three Party Mode wins', () => {
  const st = new BoxProfileStore(null), a = st.create();
  for (const k of GUESSING.slice(0, -1)) st.recordGame(a.id, { game: k, place: 1, of: 3, pts: 10, room: 'R' });
  assert(!st.view(a.id).trophies.find((t) => t.id === 'mindReader').earned);
  const news = st.recordGame(a.id, { game: GUESSING.at(-1), place: 1, of: 3, pts: 10, room: 'R' });
  assert(news.some((t) => t.id === 'mindReader'));
  for (let i = 0; i < 3; i++) st.recordParty(a.id, { place: 1, of: 5, room: 'R' });
  const v = st.view(a.id);
  assert.equal(v.stats.partyWins, 3); assert(v.trophies.find((t) => t.id === 'partyWin3').earned); assert.equal(v.stats.bestParty, 1);
  assert.equal(st.recordParty(a.id, { place: 1, of: 1 }).length, 0); assert.equal(st.view(a.id).stats.partyWins, 3, 'a party of one is not a win');
});

test('Name + PIN: claim a name, sign in on another phone, wrong PINs slow down, names are unique', () => {
  const st = new BoxProfileStore(null), a = st.create('Ana'), b = st.create('Ben');
  assert.equal(st.claim(a.id, 'Ana', '12').ok, false, 'PIN too short');
  assert(st.claim(a.id, 'Ana', '4321').ok);
  assert.equal(st.claim(b.id, 'ana', '1111').ok, false, 'name taken (any case)');
  assert(!JSON.stringify(st.data).includes('4321'), 'the PIN is hashed');
  assert.equal(st.login('Ana', '0000').ok, false);
  const l = st.login('ANA', '4321'); assert(l.ok); assert.equal(l.id, a.id);
  assert(st.authenticate({ id: a.id, token: l.token }), 'the new phone has its own token'); assert(st.authenticate(a), 'the old phone still works');
  for (let i = 0; i < 5; i++) st.login('Ana', '9999');
  assert.match(st.login('Ana', '4321').error, /Too many tries/);
});

test('Passwords: any characters, 4 to 64; hashed; saved once, then only changed with the old one', () => {
  const st = new BoxProfileStore(null), a = st.create('Cleo'), b = st.create('Dev');
  for (const bad of ['abc', '', 'x'.repeat(65), 'ab\ncd', null, 1234]) assert.equal(st.claim(a.id, 'Cleo', bad).ok, false, 'rejected: ' + JSON.stringify(bad));
  const pw = 'Purple Pizza! 🍕';
  assert(st.claim(a.id, 'Cleo', pw).ok);
  assert(!JSON.stringify(st.data).includes('Purple'), 'the password is hashed');
  const v = st.view(a.id); assert.equal(v.hasPassword, true); assert.equal(v.claimed, 'Cleo');
  assert.equal(st.claim(a.id, 'Cleo2', 'another one').ok, false, 'already saved: no silent password reset');
  assert(st.claim(b.id, 'Dev', 'x'.repeat(64)).ok, '64 characters is fine');
  assert.equal(st.login('Cleo', 'purple pizza! 🍕').ok, false, 'case matters');
  const l = st.login(' cleo ', pw); assert(l.ok); assert.equal(l.id, a.id);
  // Change the password: needs the old one; wrong guesses slow down.
  assert.match(st.changePassword(a.id, 'nope', 'new-secret').error, /current password/);
  assert.equal(st.changePassword(a.id, pw, 'abc').ok, false, 'the new one follows the rules');
  assert(st.changePassword(a.id, pw, 'new-secret').ok);
  assert.equal(st.login('Cleo', pw).ok, false, 'the old password stops working');
  assert(st.login('Cleo', 'new-secret').ok);
  for (let i = 0; i < 5; i++) st.changePassword(a.id, 'wrong!', 'whatever');
  assert.match(st.changePassword(a.id, 'new-secret', 'again-new').error, /Too many tries/);
  assert.equal(st.changePassword(st.create('Eve').id, 'x', 'yyyy').ok, false, 'not saved yet');
  // Sign out on one phone: that token stops, the other phones keep working.
  assert(st.forgetDevice({ id: a.id, token: l.token }));
  assert.equal(st.authenticate({ id: a.id, token: l.token }), null); assert(st.authenticate(a));
});

test('Old PIN accounts: a saved file with { pin } still signs in (a PIN is a numeric password)', () => {
  const file = path.join(__dirname, '..', '.data', 'box-profile-pin-' + process.pid + '.json');
  try {
    const st = new BoxProfileStore(file), a = st.create('Old');
    assert(st.claim(a.id, 'Old', '1234').ok);
    // Rewrite the file the way older versions saved it: the hash under `pin`.
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')), p = raw.profiles[a.id];
    p.pin = p.password; delete p.password; fs.writeFileSync(file, JSON.stringify(raw));
    const again = new BoxProfileStore(file);
    assert.equal(again.view(a.id).hasPassword, true);
    assert(again.login('Old', '1234').ok, 'the old PIN signs in');
    assert.equal(again.login('Old', '4321').ok, false);
    assert(again.changePassword(a.id, '1234', 'a real password').ok, 'and can become a real password');
    assert(again.login('Old', 'a real password').ok);
    assert(!('pin' in again.get(a.id)), 'migrated');
  } finally { try { fs.unlinkSync(file); } catch { /* gone */ } }
});

test('Persistence: written to a file and read back (atomic write); memory store writes nothing', () => {
  const file = path.join(__dirname, '..', '.data', 'box-profile-test-' + process.pid + '.json');
  try {
    const st = new BoxProfileStore(file), a = st.create('Ana');
    st.recordGame(a.id, { game: 'price', place: 1, of: 2, pts: 10, room: 'R' }); st.claim(a.id, 'Ana', '1234');
    const again = new BoxProfileStore(file);
    assert(again.authenticate(a)); assert.equal(again.view(a.id).stats.wins, 1); assert(again.login('Ana', '1234').ok);
  } finally { try { fs.unlinkSync(file); } catch { /* gone */ } }
});

test('Rooms record every finished game for linked players (scoreParty), bots and unlinked players are skipped', () => {
  const st = new BoxProfileStore(null), clock = new VirtualClock();
  const r = new BoxRoom('PROF', GAMES.price, { clock, seed: 5, profiles: st });
  const ana = r.join('Ana').player, ben = r.join('Ben').player; r.addBots(3);
  const auth = st.create('Ana'); ana.profileId = auth.id;
  assert(r.start().ok); runOut(r, clock); r.flush();
  const v = st.view(auth.id), place = r.played[0].top.findIndex((t) => t.id === ana.id) + 1;
  assert.equal(v.stats.games, 1); assert.equal(v.stats.nights, 1);
  assert.equal(v.stats.partyPts, r.party.get(ana.id).pts, 'lifetime points = party points');
  if (place === 1) assert.equal(v.stats.wins, 1);
  assert.equal(ben.profileId, undefined);
  r.flush(); assert.equal(st.view(auth.id).stats.games, 1, 'scored once');
  // A second game the same night: still one night.
  assert(r.hostAction({ type: 'again' }).ok); runOut(r, clock); r.flush();
  assert.equal(st.view(auth.id).stats.games, 2); assert.equal(st.view(auth.id).stats.nights, 1);
});

test('No profiles: a room without a store behaves as before', () => {
  const clock = new VirtualClock(), r = new BoxRoom('NOPR', GAMES.likely, { clock, seed: 2 });
  r.join('Ana'); r.addBots(4); assert(r.start().ok); runOut(r, clock); r.flush();
  assert.equal(r.played.length, 1); assert(r.partyBoard()[0].pts > 0);
  assert.equal(r.playerState(r.list()[0]).me.profile, false);
});

test('Party Mode finished: party wins recorded, then the recap starts by itself', () => {
  const st = new BoxProfileStore(null), clock = new VirtualClock();
  const r = new BoxRoom('PRTY', GAMES.price, { clock, seed: 9, profiles: st });
  const ana = r.join('Ana').player; r.addBots(4);
  const auth = st.create('Ana'); ana.profileId = auth.id;
  r.setParty([GAMES.price, GAMES.likely], 30);
  assert(r.start().ok);
  let guard = 0; while (!(r.partyMode.phase === 'done' && r.recap) && clock.step()) { r.flush(); if (++guard > 800000) throw new Error('party never ended'); }
  assert.equal(r.partyMode.phase, 'done'); assert(r.recap, 'the recap reel started after the finale');
  const v = st.view(auth.id); assert.equal(v.stats.partiesPlayed, 1); assert.equal(v.stats.games, 2);
  const board = r.partyBoard(); if (board[0].id === ana.id) assert.equal(v.stats.partyWins, 1);
});

test('Recap: games and winners, champion, moments, an award for every player, a personal card', () => {
  const clock = new VirtualClock(), r = new BoxRoom('RCAP', GAMES.price, { clock, seed: 4 });
  const ana = r.join('Ana').player; r.addBots(5);
  assert.equal(r.hostAction({ type: 'recap' }).ok, false, 'nothing to recap yet');
  assert(r.start().ok); runOut(r, clock); r.flush();
  assert(r.switchGame(GAMES.likely).ok); assert(r.start().ok); runOut(r, clock); r.flush();
  assert(r.hostAction({ type: 'recap' }).ok);
  const rc = r.tvState().recap;
  assert.equal(rc.played.length, 2); assert(rc.played.every((g) => g.title && 'winner' in g));
  assert.equal(rc.champion.id, r.partyBoard()[0].id);
  const ids = new Set(rc.awards.map((a) => a.id));
  for (const p of r.list()) assert(ids.has(p.id), 'everyone gets an award: ' + p.name);
  assert(Array.isArray(rc.moments));
  const me = r.playerState(ana).recap;
  assert.equal(me.of, 6); assert(me.rank >= 1); assert(me.awards.length >= 1); assert.equal(me.played, 2);
  assert.deepEqual(personalRecap(r, rc, ana).awards, me.awards);
  assert(r.hostAction({ type: 'recapClose' }).ok); assert.equal(r.tvState().recap, null); assert.equal(r.playerState(ana).recap, null);
  // Moments come from what the games report: a fake closest finish shows up.
  r.played[0].gap = { a: 'Ana', b: 'Bob', top: 100, diff: 1 };
  assert(buildRecap(r).moments.some((m) => m.kind === 'close' && /by just 1/.test(m.text)));
});

console.log(`\nAll ${passed} box profile tests passed.`);
