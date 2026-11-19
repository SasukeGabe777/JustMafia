'use strict';
// Season pass items, JustMafia games feeding the box-wide season pass, the Blood Moon event and party mode.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { ProfileStore } = require('../profiles');
const C = require('../public/shared/cosmetics');
const { Room } = require('../game');
const { VirtualClock } = require('../clock');

let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  ✓ ${name}`); };
const win = { won: true, alive: true, team: 'town', metrics: { abilities: 1 } };

(async () => {
  // JustMafia's own season pass and weekly challenges moved to the box-wide system
  // (box/progress.js, tools/test-progress.js). What stays here: pass items are earned, not sold;
  // a JustMafia game feeds the season pass and the challenges; the Judge's events multiply XP.
  await test('Pass cosmetics are earned, not sold (in JustMafia and in the shared shop)', () => {
    const free = C.CATALOG.filter((i) => i.free).length;
    assert(free < C.CATALOG.length / 3, `only ${free} of ${C.CATALOG.length} items are free`);
    const s = new ProfileStore(), a = s.create();
    s.grant(a.id, 5000);
    for (const item of C.CATALOG.filter((i) => i.pass)) {
      assert.equal(s.buy(a.id, item.id).ok, false, item.id);
      assert(!s.view(a.id).owned.includes(item.id));
    }
  });

  await test('A JustMafia game feeds the box-wide season pass; its premium track is bought from JustMafia’s phone too', () => {
    const s = new ProfileStore(); s.now = () => Date.parse('2026-11-19T12:00:00Z'); // during Harvest Fest
    const a = s.create(), P = () => s.view(a.id);
    assert.equal(s.buyPass(a.id).ok, false, 'too poor');
    for (let i = 0; i < 6; i++) s.award(a.id, 'g' + i, win);
    const season = P().progress.season;
    assert.equal(season.id, 'harvest-2026'); assert(season.tier >= 2, `tier ${season.tier}`);
    assert(season.track.filter((t) => t.tier <= season.tier).every((t) => t.freeGot && !t.premGot), 'free track only');
    s.grant(a.id, 400);
    const r = s.buyPass(a.id); assert(r.ok, r.error);
    assert(r.rewards.length >= season.tier && r.rewards.every((x) => x.side === 'premium'), 'premium tiers paid back');
    assert.equal(s.buyPass(a.id).ok, false, 'cannot buy twice');
    assert(P().progress.season.track.filter((t) => t.tier <= season.tier).every((t) => t.premGot));
  });

  await test('Blood Moon event doubles the game’s XP (challenge XP is not doubled)', () => {
    const s = new ProfileStore(), a = s.create(), b = s.create();
    const gameXp = (r) => r.progress.xp - r.progress.completed.reduce((n, c) => n + c.xp, 0);
    const plain = s.award(a.id, 'x', win), moon = s.award(b.id, 'y', { ...win, event: 'bloodMoon' });
    assert.equal(moon.progress.multiplier, 2); assert.equal(gameXp(moon), gameXp(plain) * 2);
  });

  await test('Blood Moon: every third night the Mafia kill twice', () => {
    const clock = new VirtualClock(), room = new Room('MOON', null, { clock, seed: 5 });
    const names = ['Ma', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11'];
    const P = {}; for (const name of names) { const p = room.join({ name }).player; p.sockets = 1; P[name] = p; }
    room.updateSettings({ roleSelection: 'manual', autoMafia: false, roleCounts: { mafia: 1 }, minPlayers: 3, botsAuto: false, skipCinematics: true, event: 'bloodMoon' });
    room.updateSettings({ forcedRoles: { [P.Ma.id]: 'mafia' } });
    assert(room.hostAction({ type: 'start' }).ok);
    let moonNights = 0;
    for (let n = 0; n < 4 && room.phase !== 'gameover'; n++) {
      while (room.phase !== 'night' && room.phase !== 'gameover') room.advance();
      if (room.phase === 'gameover') break;
      const moon = !!room.night.bloodMoon; if (moon) moonNights++;
      assert.equal(moon, room.day % 3 === 0, `night of day ${room.day}`);
      const target = room.alive().find((p) => p.id !== P.Ma.id);
      room.voteMafia(P.Ma, target.id);
      const before = room.alive().length;
      room.advance(); room.advance();
      const died = before - room.alive().length;
      assert.equal(died, moon ? 2 : 1, `${died} died on ${moon ? 'a Blood Moon' : 'a normal'} night`);
    }
    assert(moonNights >= 1, 'saw a Blood Moon');
  });

  await test('Party mode lets anyone wear locked cosmetics (sockets)', async () => {
    const { io } = require('socket.io-client');
    const PORT = 3994, URL = 'http://localhost:' + PORT, sockets = [];
    const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: String(PORT), MT_PROFILE_STORE: 'memory' }, stdio: 'pipe' });
    let errors = ''; server.stderr.on('data', (d) => { errors += d; });
    const socket = () => { const s = io(URL, { transports: ['websocket'] }); sockets.push(s); return s; };
    const emit = (s, ev, data = {}) => new Promise((res, rej) => s.timeout(4000).emit(ev, data, (err, r) => (err ? rej(err) : res(r))));
    try {
      await new Promise((res, rej) => { server.stdout.on('data', (d) => { if (String(d).includes('Mafia Town is running')) res(); }); setTimeout(() => rej(Error(errors || 'Server did not start')), 5000).unref(); });
      const look = { hair: 'afro', hat: 'bloodCrown', outfit: 'vampire' };
      const tv = socket(), room = await emit(tv, 'host:create');
      const judge = socket(); assert((await emit(judge, 'judge:attach', { code: room.code, hostKey: room.hostKey })).ok);
      const join = async (name) => { const s = socket(); assert((await emit(s, 'profile:create')).ok); const r = await emit(s, 'player:join', { code: room.code, name, avatar: look }); assert(r.ok, r.error); r.s = s; return r; };
      let latest = null; tv.on('host:state', (s) => { latest = s; });
      const playerOnTv = async (name) => { for (let i = 0; i < 200; i++) { const p = latest && latest.players.find((x) => x.name === name); if (p) return p; await new Promise((r) => setTimeout(r, 25)); } throw new Error(`${name} never appeared on the TV`); };
      // Without party mode, locked items fall back to defaults.
      const plain = await join('Plain');
      let me = await playerOnTv('Plain');
      assert.notEqual(me.avatar.hair, 'afro'); assert.notEqual(me.avatar.outfit, 'vampire');
      // A refused vote answers with a reason (the phone shows it instead of failing silently).
      const refused = await emit(plain.s, 'player:vote', { targetId: 'nobody' });
      assert.equal(refused.ok, false); assert.match(refused.error, /Voting is closed/);
      assert.equal((await emit(socket(), 'room:check', { code: room.code })).party, false);
      assert((await emit(judge, 'host:action', { type: 'settings', settings: { partyMode: true } })).ok);
      assert.equal((await emit(socket(), 'room:check', { code: room.code })).party, true);
      await join('Party');
      me = await playerOnTv('Party');
      assert.equal(me.avatar.hair, 'afro'); assert.equal(me.avatar.hat, 'bloodCrown'); assert.equal(me.avatar.outfit, 'vampire');
    } finally { for (const s of sockets) s.close(); server.kill(); }
  });

  console.log(`All ${passed} season tests passed.`);
})().catch((e) => { console.error(e); process.exit(1); });
