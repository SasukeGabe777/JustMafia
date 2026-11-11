'use strict';
// Season pass, weekly challenges, the Blood Moon event and party mode.
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
  await test('Weekly challenges: three distinct, stable per week', () => {
    for (const week of ['2026-W01', '2026-W02', '2026-W46', '2027-W52']) {
      const ids = C.weeklyChallenges(week);
      assert.equal(ids.length, 3); assert.equal(new Set(ids).size, 3);
      for (const k of ids) assert(C.CHALLENGES[k], k);
      assert.deepEqual(C.weeklyChallenges(week), ids, 'same week, same challenges');
    }
    assert.match(C.weekKey(new Date('2026-11-11')), /^2026-W\d\d$/);
  });

  await test('Most cosmetics are now earned; pass items cannot be bought', () => {
    const free = C.CATALOG.filter((i) => i.free).length;
    assert(free < C.CATALOG.length / 3, `only ${free} of ${C.CATALOG.length} items are free`);
    const s = new ProfileStore(), a = s.create();
    s.grant(a.id, 5000);
    for (const item of C.CATALOG.filter((i) => i.pass)) {
      assert.equal(s.buy(a.id, item.id).ok, false, item.id);
      assert(!s.view(a.id).owned.includes(item.id));
    }
  });

  await test('Season pass costs gold and pays every reached tier retroactively', () => {
    const s = new ProfileStore(), a = s.create(), P = () => s.view(a.id);
    assert.equal(s.buyPass(a.id).ok, false, 'too poor');
    for (let i = 0; i < 6; i++) s.award(a.id, 'g' + i, win);
    const xp = P().season.xp, tier = P().season.tier;
    assert(tier >= 2, `reached tier ${tier} with ${xp} XP`);
    assert.equal(P().season.granted.length, 0, 'no rewards without the pass');
    s.grant(a.id, C.SEASON.cost);
    const coins = P().coins, r = s.buyPass(a.id);
    assert(r.ok); assert.equal(r.rewards.map((x) => x.tier).filter((t, i, l) => l.indexOf(t) === i).length, tier);
    const tierGold = r.rewards.reduce((n, x) => n + (x.gold || 0), 0);
    assert.equal(P().coins, coins - C.SEASON.cost + tierGold);
    assert.equal(s.buyPass(a.id).ok, false, 'cannot buy twice');
    // Playing on keeps unlocking tiers, including pass-exclusive cosmetics.
    for (let i = 6; i < 60; i++) s.award(a.id, 'g' + i, win);
    assert.equal(P().season.tier, C.SEASON.tiers);
    for (const item of C.CATALOG.filter((i) => i.pass)) assert(P().owned.includes(item.id), item.id);
    assert.equal(s.validateAvatar(a.id, { outfit: 'bloodKnight' }).outfit, 'bloodKnight');
    assert.equal(P().season.granted.length, C.SEASON.tiers, 'each tier granted once');
  });

  await test('Challenges progress across games and pay out once', () => {
    const s = new ProfileStore(), a = s.create(), P = () => s.view(a.id);
    const play = P().season.challenges.find((c) => /^play/.test(c.id)) || P().season.challenges[0];
    let paid = 0;
    for (let i = 0; i < 8; i++) {
      const r = s.award(a.id, 'c' + i, { won: true, alive: true, team: 'mafia', metrics: { abilities: 3, saves: 1, correctInvestigations: 1 } });
      paid += r.lines.filter((l) => l.key === 'challenge').length;
    }
    for (const c of P().season.challenges) { assert(c.done, c.id); assert.equal(c.progress, c.count); }
    assert.equal(paid, 3, 'each challenge paid exactly once');
    assert(P().ledger.some((l) => l.reason === `Weekly challenge: ${play.label}`));
  });

  await test('Blood Moon event doubles season XP', () => {
    const s = new ProfileStore(), a = s.create(), b = s.create();
    const plain = s.award(a.id, 'x', win).season.xp, moon = s.award(b.id, 'y', { ...win, event: 'bloodMoon' }).season;
    assert.equal(moon.multiplier, 2); assert.equal(moon.xp, plain * 2);
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
      const join = async (name) => { const s = socket(); assert((await emit(s, 'profile:create')).ok); const r = await emit(s, 'player:join', { code: room.code, name, avatar: look }); assert(r.ok, r.error); return r; };
      const ownState = () => new Promise((res) => tv.once('host:state', res));
      // Without party mode, locked items fall back to defaults.
      await join('Plain');
      let st = await ownState(); let me = st.players.find((p) => p.name === 'Plain');
      assert.notEqual(me.avatar.hair, 'afro'); assert.notEqual(me.avatar.outfit, 'vampire');
      assert.equal((await emit(socket(), 'room:check', { code: room.code })).party, false);
      assert((await emit(judge, 'host:action', { type: 'settings', settings: { partyMode: true } })).ok);
      assert.equal((await emit(socket(), 'room:check', { code: room.code })).party, true);
      const wait = ownState(); await join('Party'); st = await wait;
      me = st.players.find((p) => p.name === 'Party');
      assert.equal(me.avatar.hair, 'afro'); assert.equal(me.avatar.hat, 'bloodCrown'); assert.equal(me.avatar.outfit, 'vampire');
    } finally { for (const s of sockets) s.close(); server.kill(); }
  });

  console.log(`All ${passed} season tests passed.`);
})().catch((e) => { console.error(e); process.exit(1); });
