'use strict';
// Launch rehearsal: 20 real socket "phones" (own profiles, looks, houses, move-in
// requests) play several complete games against a real server, acting like people:
// night actions, votes, verdict interventions and last words. Checks that nobody
// ever sees a living player's hidden role, that the server logs no errors, that no
// game gets stuck, and reports update sizes. Run: node tools/stress-20.js [players] [games]
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { io } = require('socket.io-client');
const O = require('../public/shared/options');

const N = Number(process.argv[2]) || 20, GAMES = Number(process.argv[3]) || 3, PORT = 3989, URL = `http://localhost:${PORT}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const emit = (s, ev, d = {}) => new Promise((r) => s.timeout(5000).emit(ev, d, (err, res) => r(err ? { ok: false, error: 'timeout ' + ev } : res)));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const NAMES = ['Ana', 'Ben', 'Cy', 'Di', 'Eve', 'Finn', 'Gus', 'Hana', 'Ivy', 'Jo', 'Kai', 'Lia', 'Max', 'Nia', 'Oz', 'Pia', 'Quin', 'Rex', 'Sol', 'Tia', 'Uma', 'Vic', 'Wes', 'Xia', 'Yoyo', 'Zed'];

(async () => {
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: String(PORT), MT_PROFILE_STORE: 'memory' }, stdio: 'pipe' });
  let serverErrors = ''; server.stderr.on('data', (b) => { serverErrors += b; });
  await new Promise((resolve, reject) => { server.stdout.on('data', (b) => { if (String(b).includes('Mafia Town is running')) resolve(); }); setTimeout(() => reject(new Error('server did not start')), 8000).unref(); });
  const problems = [], stats = { states: 0, maxBytes: 0, totalBytes: 0, tvMaxBytes: 0, phases: 0, executions: {}, games: [] };
  const host = io(URL, { transports: ['websocket'] }); let tv = null;
  host.on('host:state', (s) => {
    tv = s; const b = JSON.stringify(s).length; stats.tvMaxBytes = Math.max(stats.tvMaxBytes, b);
    if (s.phase !== 'gameover') for (const p of s.players) if (p.alive && p.role) problems.push(`TV saw living ${p.name}'s role in ${s.phase}`);
    if (s.cinematic && s.cinematic.type === 'execution') stats.executions[s.cinematic.id] = s.cinematic.outcome;
  });
  const room = await emit(host, 'host:create');
  await emit(host, 'host:action', { type: 'settings', settings: { maxPlayers: 100, minPlayers: 5 } });

  // 20 phones join with their own looks and houses.
  const phones = [];
  for (let i = 0; i < N; i++) {
    const s = io(URL, { transports: ['websocket'], forceNew: true }); s.name = NAMES[i % NAMES.length] + (i >= NAMES.length ? i : '');
    s.on('player:state', (v) => {
      s.view = v; const b = JSON.stringify(v).length; stats.states++; stats.totalBytes += b; stats.maxBytes = Math.max(stats.maxBytes, b);
      if (v.phase !== 'gameover') for (const x of v.players) if (x.alive && x.role && x.id !== v.you.id) problems.push(`${s.name} saw living ${x.name}'s role (${x.role}) in ${v.phase}`);
    });
    await emit(s, 'profile:create');
    const r = await emit(s, 'player:join', { code: room.code, name: s.name, avatar: { color: pick(O.colors), hair: pick(O.hair), expression: pick(O.expression), outfit: pick(O.outfit.slice(0, 12)) }, home: { style: pick(O.houseStyle.slice(0, 12)), door: pick(O.doorStyle) } });
    if (!r.ok) problems.push(`${s.name} could not join: ${r.error}`);
    s.playerId = r.playerId; phones.push(s);
  }
  await wait(400);
  assert.equal(tv.players.length, N, 'everyone joined');
  // Move-in requests: two accepted, one declined.
  for (const [a, b, yes] of [[1, 0, true], [2, 0, true], [4, 3, false]]) {
    const r = await emit(phones[a], 'player:home', { claim: { with: phones[b].playerId } }); if (!r.pending) problems.push('move-in request did not pend');
    await wait(100); const rr = await emit(phones[b], 'player:moveReply', { fromId: phones[a].playerId, accept: yes }); if (!rr.ok) problems.push('move-in reply failed');
  }
  await wait(300);
  assert.equal(tv.players.find((p) => p.id === phones[1].playerId).livesWith, phones[0].playerId);
  assert.equal(tv.players.find((p) => p.id === phones[4].playerId).livesWith, null);

  for (let game = 1; game <= GAMES; game++) {
    const t0 = Date.now(); let ticks = 0;
    const st = await emit(host, 'host:action', { type: 'start' }); if (st && st.ok === false) throw new Error('start failed: ' + st.error);
    let lastPhase = null, phaseSince = Date.now();
    while (tv.phase !== 'gameover') {
      if (++ticks > 4000) { problems.push(`game ${game} stuck in ${tv.phase}`); break; }
      if (tv.phase !== lastPhase) { lastPhase = tv.phase; phaseSince = Date.now(); stats.phases++; }
      // Phones act like people.
      for (const s of phones) {
        const v = s.view; if (!v || !v.you.alive) continue;
        if (v.phase === 'night' && v.action && !v.action.choice && v.action.targets && v.action.targets.length && !s.acted) { const tg = pick(v.action.targets); s.emit('player:night', { targetId: typeof tg === 'string' ? tg : tg.id }); s.acted = true; }
        if (v.phase === 'voting' && v.voting && !v.voting.choice && v.voting.targets.length && !s.voted) { const tg = pick(v.voting.targets); s.emit('player:vote', { targetId: typeof tg === 'string' ? tg : tg.id }); s.voted = true; }
        if (v.phase === 'verdict' && v.verdict && !s.verdicted) {
          s.verdicted = true; const o = v.verdict;
          if (o.isCondemned && o.lastWords && o.lastWords.names.length) s.emit('player:lastWords', { nameId: pick(o.lastWords.names).id, word: pick(o.lastWords.words) });
          else if (o.canInterrupt && Math.random() < 0.3) s.emit('player:intervene', { kind: 'interrupt' });
          else if (o.canSacrifice && Math.random() < 0.3) s.emit('player:intervene', { kind: 'sacrifice' });
          else if (o.canProtect && Math.random() < 0.3) s.emit('player:intervene', { kind: 'protect' });
          else if (Math.random() < 0.15) s.emit('player:intervene', { kind: 'defend' });
        }
        if (v.phase !== 'night') s.acted = false; if (v.phase !== 'voting') s.voted = false; if (v.phase !== 'verdict') s.verdicted = false;
      }
      // The host moves things along (like pressing Next phase when everyone is done).
      const age = Date.now() - phaseSince;
      if ((tv.phase === 'night' || tv.phase === 'voting') && age > 900) await emit(host, 'host:action', { type: 'skip' });
      else if (!['night', 'voting', 'gameover'].includes(tv.phase) && age > 350) await emit(host, 'host:action', { type: 'skip' });
      await wait(60);
    }
    stats.games.push({ game, winner: tv.winner, ms: Date.now() - t0, alive: tv.players.filter((p) => p.alive).length });
    console.log(`  ✓ game ${game}: ${tv.winner} won in ${((Date.now() - t0) / 1000).toFixed(1)}s, ${tv.players.filter((p) => p.alive).length}/${N} alive`);
    await wait(400);
    // Every phone gets its own result at game over.
    const withResult = phones.filter((s) => s.view && s.view.phase === 'gameover' && s.view.reward).length;
    if (withResult !== N) problems.push(`game ${game}: only ${withResult}/${N} phones got their end-of-game result`);
    await emit(host, 'host:action', { type: 'lobby' }); await wait(500);
    if (tv.phase !== 'lobby') problems.push('back to lobby failed');
  }
  const guards = (serverErrors.match(/\[guard\]/g) || []).length;
  if (guards) problems.push(`server logged ${guards} guarded errors:\n` + serverErrors.slice(0, 2000));
  console.log(`  updates: ${stats.states} phone states (max ${(stats.maxBytes / 1024).toFixed(1)} KB, avg ${(stats.totalBytes / stats.states / 1024).toFixed(1)} KB), TV max ${(stats.tvMaxBytes / 1024).toFixed(1)} KB`);
  console.log(`  executions: ${JSON.stringify(Object.values(stats.executions).reduce((m, o) => ({ ...m, [o]: (m[o] || 0) + 1 }), {}))}`);
  phones.forEach((s) => s.close()); host.close(); server.kill();
  if (problems.length) { console.error('PROBLEMS:\n' + [...new Set(problems)].slice(0, 30).join('\n')); process.exit(1); }
  console.log(`All ${GAMES} games with ${N} players completed cleanly.`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
